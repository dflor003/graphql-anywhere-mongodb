import { Db } from 'mongodb';
import { DocumentNode } from 'graphql';
import { findMultiple, findOne, GraphQLExecutionResult } from './mongo-queries';
import { graphqlToMongo } from './graphql-to-mongo';
import { log } from './log';

/**
 * Function that formats errors off of {GraphQLExecutionResult}s.
 */
export type ErrorFormatter = (result: GraphQLExecutionResult, includeStack?: boolean) => any;

/**
 * Options to change the behavior of the GraphQL mongo client.
 */
export interface GraphQLMongoClientOptions {
  /**
   * Whitelist of collections that can be queried. If provided, an error will be thrown any time an attempt is
   * made to query a collection not in the whitelist.
   */
  whitelist?: string[];

  /**
   * If true, will include stack trace in error results. Defaults to false.
   */
  includeStack?: boolean;

  /**
   * Function to format error objects. Defaults to the following format:
   * {
   *   collection: string;
   *   message: string;
   *   stack?: string[]; // if includeStack === true
   * }
   */
  formatError?: ErrorFormatter;
}

/**
 * Results from a graphql query. Will contain the {data} element which will have results
 * for every collection-based query that succeeded as well as an {errors} array that will contain
 * any errors that occurred.
 */
export interface QueryResult {
  /**
   * The data that was retrieved. Will have an entry per collection queried under that collection's name.
   *
   * @example
   * If you query for the following:
   *
   * {
   *   users {
   *     name
   *   }
   *   places {
   *     lat
   *     lng
   *   }
   * }
   *
   * Your response will be:
   * {
   *   data: {
   *     users: [ ...users results here ],
   *     places: [ ...places results here ],
   *   }
   * }
   */
  data: {
    [collection: string]: any;
  };

  /**
   * Errors that occurred during the process (if any).
   */
  errors?: any[];
}

/**
 * A mongo client that wraps the standard node MongoDB driver with
 * an API that allows for making queries using GraphQL.
 */
export class MongoGraphQLClient {
  private readonly connection: Db;
  private readonly whitelist: string[];
  private readonly includeStack: boolean;
  private readonly errorFormatter: ErrorFormatter;

  /**
   * Create a new {MongoGraphQLClient}.
   * @param connection The DB connection.
   * @param options Options to change the behavior of the client.
   */
  constructor(connection: Db, options?: GraphQLMongoClientOptions) {
    options = options || {};
    if (!connection) {
      throw new Error(`No mongo connection passed`);
    }

    this.connection = connection;
    this.whitelist = (options.whitelist || [])
      .map(collection => collection.toLowerCase());
    this.includeStack = options.includeStack === true;
    this.errorFormatter = options.formatError || defaultErrorFormatter;

    log('Mongo GraphQL client initialized with options', {
      database: this.connection.databaseName,
      whitelist: this.whitelist,
      includeStack: this.includeStack,
      errorFormatter: this.errorFormatter,
    });
  }

  /**
   * Performs a MongoDB find operation for every collection specified in the passed
   * GraphQL query and returns the results and any errors as a promise.
   *
   * @param query The query to perform.
   * @param variables Variables to use in the query.
   * @return {Promise<QueryResult>} The result of the queries.
   */
  async find(query: DocumentNode, variables?: object): Promise<QueryResult> {
    // Convert graphql to info about how to execute query
    const queryInfos = graphqlToMongo(query, variables);

    // Check collections against whitelist
    if (this.whitelist.length) {
      queryInfos
        .map(q => q.collection)
        .filter(collection => !this.whitelist.includes(collection.toLowerCase()))
        .forEach(collection => {
          throw new Error(`Can not query collection '${collection}'`);
        });
    }

    // Execute the query and get back the results
    const results = await findMultiple(this.connection, queryInfos);

    // Check for errors
    const errors = results
      .filter(result => !!result.error)
      .map(result => this.errorFormatter(result, this.includeStack));

    // Build a cohesive return value with all results
    return {
      data: results.reduce((obj, result) => ({
        ...obj,
        [result.collection]: result.results
      }), {}),
      errors: !errors.length ? undefined : errors
    }
  }

  /**
   * Performs a MongoDB findOne operation for exactly one collection and returns
   * just a single document for that collection. Will throw an error if multiple
   * collections are included in the query.
   *
   * @param query The query to perform,.
   * @param variables Variables to use in the query.
   * @return {Promise<QueryResult>}
   */
  async findOne(query: DocumentNode, variables?: object): Promise<QueryResult> {
    // Convert graphql to info about how to execute query
    const queryInfos = graphqlToMongo(query, variables);

    // Ensure we only have one
    if (!queryInfos || queryInfos.length !== 1) {
      throw new Error(`Must have exactly one query for a findOne operation`);
    }

    // Execute the findOne query and get back the results
    const result = await findOne(this.connection, queryInfos[0]);

    // Build a cohesive return value with the results
    return {
      data: result.error
        ? null
        : { [result.collection]: result.results },
      errors: !result.error
        ? undefined
        : [this.errorFormatter(result, this.includeStack)]
    };
  }
}

/**
 * Default error formatter
 * @param result The result of the query.
 * @param includeStack If true, signifies that stack should be printed.
 */
export function defaultErrorFormatter(result: GraphQLExecutionResult, includeStack: boolean) {
  return {
    collection: result.collection,
    message: result.error.message || result.error,
    stack: includeStack === true
      ? (result.error.stack || '').split('\n')
      : undefined
  }
}
