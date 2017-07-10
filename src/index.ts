import { graphqlClient } from './mongo-grqphql-client-factory';

export { MongoGraphQLClient, GraphQLMongoClientOptions } from './mongo-graphql-client';
export { graphqlToMongo } from './graphql-to-mongo';
export { findOne, findAll, findMultiple } from './mongo-queries';

export default graphqlClient;
