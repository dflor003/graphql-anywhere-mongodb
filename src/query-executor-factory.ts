import { Db, MongoClient, MongoClientOptions } from 'mongodb';
import { GraphQLMongoQueryExecutor } from './query-executor';

function forConnection(connection: Db): GraphQLMongoQueryExecutor {
  return new GraphQLMongoQueryExecutor(connection);
}

async function forUri(mongoUri: string, options?: MongoClientOptions): Promise<GraphQLMongoQueryExecutor> {
  if (typeof mongoUri !== 'string') {
    throw new Error(`Must pass a valid MongoDB connection string`);
  }

  const connection = await MongoClient.connect(mongoUri, options);
  return forConnection(connection);
}

export interface GraphQLQueryExecutorFactory {
  forConnection(connection: Db): GraphQLMongoQueryExecutor;
  forUri(mongoUri: string, options?: MongoClientOptions): Promise<GraphQLMongoQueryExecutor>;
}

export const graphql: GraphQLQueryExecutorFactory = {
  forConnection,
  forUri,
};
