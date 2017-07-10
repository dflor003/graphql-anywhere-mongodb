import * as util from 'util';
import { MongoQueryInfo } from './graphql-to-mongo';
import { Db } from 'mongodb';
import { log } from './log';

export interface GraphQLExecutionResult {
  collection: string;
  results: any[] | any;
  error: Error;
}

export async function findMultiple(connection: Db, queryInfos: MongoQueryInfo[]): Promise<GraphQLExecutionResult[]> {
  return await Promise.all(
    queryInfos.map(query => findAll(connection, query))
  );
}

const json = (args: any) => util.inspect(args, { depth: Infinity, breakLength: Infinity, colors: true });

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

  try {
    log(`Executing ${collectionName}.find(${json(queryInfo.query)}, ${json(queryInfo.fields)})`);
    const cursor = collection.find<object>(queryInfo.query, queryInfo.fields, queryInfo.skip, queryInfo.limit);
    return {
      collection: collectionName,
      results: await cursor.toArray(),
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
