import { Db } from 'mongodb';
import { DocumentNode } from 'graphql';
import { findMultiple, findOne } from './mongo-queries';
import { graphqlToMongo } from './graphql-to-mongo';

export interface QueryResult {
  data: { [collection: string]: any; };
  errors: any[];
}

export class GraphQLMongoClient {
  private readonly connection: Db;

  constructor(connection: Db) {
    if (!connection) {
      throw new Error(`No mongo connection passed`);
    }

    this.connection = connection;
  }

  async find(query: DocumentNode, variables?: object): Promise<QueryResult> {
    // Convert graphql to info about how to execute query
    const queryInfos = graphqlToMongo(query, variables);

    // Execute the query and get back the results
    const results = await findMultiple(this.connection, queryInfos);

    // Check for errors
    const errors = results
      .filter(result => !!result.error)
      .map(result => ({
        collection: result.collection,
        message: result.error.message || result.error,
      }));

    // Build a cohesive return value with all results
    return {
      data: results.reduce((obj, result) => ({
        ...obj,
        [result.collection]: result.results
      }), {}),
      errors: !errors.length ? undefined : errors
    }
  }

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
      data: result.error ? null : {
        [result.collection]: result.results
      },
      errors: !result.error ? undefined : [
        {
          collection: result.collection,
          message: result.error.message || result.error,
        }
      ]
    };
  }
}
