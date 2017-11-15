import * as util from 'util';
import { MongoQueryInfo } from './graphql-to-mongo';
import { Db } from 'mongodb';
import { log } from './log';

// Helper to print args to mongodb for debug purposes
const json = (args: any) => util.inspect(args, { depth: Infinity, breakLength: Infinity, colors: true });

/**
 * The result of executing a GraphQL query against MongoDB.
 */
export interface GraphQLExecutionResult {
  /**
   * The name of the collection that the query is for.
   */
  collection: string;

  /**
   * The results of the query. Will be a single result for findOne and an array for find.
   */
  results: any[] | any;

  /**
   * Any error that occurred as part of executing the query.
   */
  error: Error;
}

/**
 * Executes queries against multiple collections and returns all of their results.
 *
 * @param connection The mongodb connection.
 * @param queryInfos An array of {MongoQueryInfo} to execute.
 * @return {Promise<GraphQLExecutionResult[]>} The results of running all of the queries.
 */
export async function findMultiple(connection: Db, queryInfos: MongoQueryInfo[]): Promise<GraphQLExecutionResult[]> {
  return await Promise.all(
    queryInfos.map(query => findAll(connection, query))
  );
}

/**
 * Executes a single findOne query for the passed {MongoQueryInfo}.
 * @param connection The mongodb connection.
 * @param queryInfo The query {MongoQueryInfo} to execute.
 * @return {Promise<GraphQLExecutionResult>} The results of running the query.
 */
export async function findOne(connection: Db, queryInfo: MongoQueryInfo): Promise<GraphQLExecutionResult> {
  const collection = await connection.collection(queryInfo.collection);
  const collectionName = collection.collectionName;

  try {
    log(`Executing ${collectionName}.findOne(${json(queryInfo.query)}, ${json(queryInfo.fields)})`);
    const document = await collection.findOne<object>(queryInfo.query, {
      fields: queryInfo.fields,
    });
    return {
      collection: collectionName,
      results: document,
      error: null,
    };
  } catch (err) {
    return {
      collection: collectionName,
      results: null,
      error: err,
    };
  }
}

export async function findAll(connection: Db, queryInfo: MongoQueryInfo): Promise<GraphQLExecutionResult> {
  const collection = await connection.collection(queryInfo.collection);
  const collectionName = collection.collectionName;
  const hasSort = Object.keys(queryInfo.sort).length > 0;

  try {
    log(`Executing ${collectionName}.find(${json(queryInfo.query)}, ${json(queryInfo.fields)})`);
    const cursor = collection.find<object>(
      queryInfo.query,
      queryInfo.fields,
      queryInfo.skip,
      queryInfo.limit
    );

    const results = hasSort
      ? await cursor.sort(queryInfo.sort).toArray()
      : await cursor.toArray();

    return {
      collection: collectionName,
      results: results,
      error: null,
    };
  } catch (err) {
    return {
      collection: collectionName,
      results: [],
      error: err,
    };
  }
}
