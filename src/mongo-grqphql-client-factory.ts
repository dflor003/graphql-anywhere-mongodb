import { Db, MongoClient, MongoClientOptions } from 'mongodb';
import { GraphQLMongoClientOptions, MongoGraphQLClient } from './mongo-graphql-client';

export const graphqlClient = {
  /**
   * Build a {MongoGraphQLClient} from a pre-existing mongodb connection.
   *
   * @param connection The connection to build the client from.
   * @param options Options for changing the behavior of the client.
   * @return {MongoGraphQLClient} The client.
   */
    forConnection(connection: Db, options?: GraphQLMongoClientOptions): MongoGraphQLClient {
    return new MongoGraphQLClient(connection, options);
  },

  /**
   * Build a {MongoGraphQLClient} by connecting to the passed mongodb connection string.
   * It will use the native node mongodb driver to connect.
   *
   * @param mongoUri The mongodb connection string URI.
   * @param options Mongo client options and options for changing the {MongoGraphQLClient}.
   * @return {Promise<MongoGraphQLClient>} A promise resolved once connection to MongoDB
   * has been established.
   */
  async forUri(
    mongoUri: string,
    options?: GraphQLMongoClientOptions & MongoClientOptions,
  ): Promise<MongoGraphQLClient> {
    if (typeof mongoUri !== 'string') {
      throw new Error(`Must pass a valid MongoDB connection string`);
    }

    const connection = await MongoClient.connect(mongoUri, options);
    return new MongoGraphQLClient(connection, options);
  },
};
