import { Db } from 'mongodb';
import { DocumentNode } from 'graphql';
import { parse } from 'graphql/language/parser';
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

  /**
   * If no limit clause is passed, this default limit will be used. This is to prevent
   * someone accidentally pulling in thousands or millions of mongo documents by mistake.
   * Defaults to 100 if not passed.
   */
  defaultLimit?: number;

  /**
   * The maximum limit accepted for a graphql request. If a limit is encountered above this
   * an error will be thrown. Defaults to 10000.
   */
  maxLimit?: number;
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

  /**
   * Metadata about each collection query such as the limit applied and offset.
   */
  _meta?: {
    [collection: string]: {
      limit?: number;
      offset?: number;
    }
  }
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
  private readonly defaultLimit: number;
  private readonly maxLimit: number;

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
    this.defaultLimit = typeof options.defaultLimit === 'number'
      ? options.defaultLimit
      : 100;
    this.maxLimit = typeof options.maxLimit === 'number'
      ? options.maxLimit
      : 10000;

    if (this.defaultLimit > this.maxLimit) {
      throw new Error('Default limit must be less than or equal to max limit');
    }

    log('Mongo GraphQL client initialized with options', this.getOptions());
  }

  /**
   * Gets the options that this client was configured with.
   */
  getOptions() {
    return {
      database: this.connection.databaseName,
      whitelist: this.whitelist,
      includeStack: this.includeStack,
      errorFormatter: this.errorFormatter,
      defaultLimit: this.defaultLimit,
      maxLimit: this.maxLimit
    };
  }

  /**
   * Performs a MongoDB find operation for every collection specified in the passed
   * GraphQL query and returns the results and any errors as a promise.
   *
   * @param query The query to perform.
   * @param variables Variables to use in the query.
   * @return {Promise<QueryResult>} The result of the queries.
   */
  async find(query: DocumentNode | string, variables?: object): Promise<QueryResult> {
    // Convert graphql to info about how to execute query
    const document = parseDocument(query);
    const queryInfos = graphqlToMongo(document, variables)

    // Default limit on query infos if not passed
    queryInfos
      .forEach(info => info.limit = typeof info.limit === 'number' ? info.limit : this.defaultLimit);

    // Check collections against whitelist
    if (this.whitelist.length) {
      queryInfos
        .map(q => q.collection)
        .filter(collection => !this.whitelist.includes(collection.toLowerCase()))
        .forEach(collection => {
          throw new Error(`Can not query collection '${collection}'`);
        });
    }

    // Enforce max limit
    queryInfos
      .filter(info => info.limit > this.maxLimit)
      .forEach(info => {
        throw new Error(`Limit of ${info.limit} on collection '${info.collection}' exceeds the maximum of ${this.maxLimit}`);
      });

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
      errors: !errors.length ? undefined : errors,
      _meta: queryInfos.reduce((obj, info) => ({
        ...obj,
        [info.collection]: {
          limit: info.limit,
          skip: info.skip || 0
        }
      }), {})
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
  async findOne(query: DocumentNode | string, variables?: object): Promise<QueryResult> {
    // Convert graphql to info about how to execute query
    const document = parseDocument(query);
    const queryInfos = graphqlToMongo(document, variables);

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

function parseDocument(query: DocumentNode | string): DocumentNode {
  if (typeof query !== 'string' && !query) {
    throw new Error('Must pass either document or string');
  }

  // Parse query to document if passed string
  if (typeof query === 'string') {
    return parse(query);
  }

  return query;
}
