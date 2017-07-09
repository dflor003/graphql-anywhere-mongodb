import { Db, MongoClient, MongoClientOptions } from 'mongodb';
import { GraphQLMongoClient } from './graphql-mongo-client';

function forConnection(connection: Db): GraphQLMongoClient {
  return new GraphQLMongoClient(connection);
}

async function forUri(mongoUri: string, options?: MongoClientOptions): Promise<GraphQLMongoClient> {
  if (typeof mongoUri !== 'string') {
    throw new Error(`Must pass a valid MongoDB connection string`);
  }

  const connection = await MongoClient.connect(mongoUri, options);
  return forConnection(connection);
}

export interface GraphQLMongoClientFactory {
  forConnection(connection: Db): GraphQLMongoClient;
  forUri(mongoUri: string, options?: MongoClientOptions): Promise<GraphQLMongoClient>;
}

export const graphqlClient: GraphQLMongoClientFactory = {
  forConnection,
  forUri,
};
