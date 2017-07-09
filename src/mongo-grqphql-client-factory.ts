import { Db, MongoClient, MongoClientOptions } from 'mongodb';
import { MongoGraphQLClient } from './mongo-graphql-client';

function forConnection(connection: Db): MongoGraphQLClient {
  return new MongoGraphQLClient(connection);
}

async function forUri(mongoUri: string, options?: MongoClientOptions): Promise<MongoGraphQLClient> {
  if (typeof mongoUri !== 'string') {
    throw new Error(`Must pass a valid MongoDB connection string`);
  }

  const connection = await MongoClient.connect(mongoUri, options);
  return forConnection(connection);
}

export interface GraphQLMongoClientFactory {
  forConnection(connection: Db): MongoGraphQLClient;
  forUri(mongoUri: string, options?: MongoClientOptions): Promise<MongoGraphQLClient>;
}

export const graphqlClient: GraphQLMongoClientFactory = {
  forConnection,
  forUri,
};
