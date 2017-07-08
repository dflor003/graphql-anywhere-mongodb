import gql from 'graphql-tag';
import { expect } from 'chai';
import { mongoTestServer } from './util/mongo-test-server';
import { Collection, Db } from 'mongodb';
import { GraphQLMongoQueryExecutor } from '../src/query-executor';
import { graphql } from '../src/query-executor-factory';

describe('Execution of mongo graphql queries', () => {
  const server = mongoTestServer();
  let connection: Db;
  let collection1: Collection<any>;
  let collection2: Collection<any>;
  let executor: GraphQLMongoQueryExecutor;

  before(async () => {
    await server.start();
  });

  after(async () => {
    await server.stop();
  });

  beforeEach(async () => {
    connection = await server.getConnection('test-db');
    executor = graphql.forConnection(connection);
    collection1 = await connection.collection('collection1');
    collection2 = await connection.collection('collection2');
  });

  afterEach(async () => {
    await connection.dropDatabase();
  });

  describe('findOne', () => {
    it('should find a matching document', async () => {
      // Arrange
      const docs = generateDocs(5);
      await collection1.insertMany(docs);

      const query = gql`
        {
          collection1 {
            _id (eq: $id)
            firstName
            address {
              line1
              line2
            }
          }
        }
      `;

      // Act
      const results = await executor.findOne(query, { id: 3 });

      // Assert
      expect(results).to.deep.equal({
        data: {
          collection1: {
            _id: 3,
            firstName: 'Bob 3',
            address: {
              line1: 'Something 3',
              line2: 'Other thing 3'
            }
          }
        },
        errors: undefined
      });
    });
  })
});

function generateDocs(count: number): any[] {
  return Array
    .from(Array(count))
    .map((val, i) => i + 1)
    .map(index => ({
      _id: index,
      firstName: `Bob ${index}`,
      lastName: `Builder ${index}`,
      address: {
        line1: `Something ${index}`,
        line2: `Other thing ${index}`,
        city: 'Miami',
        state: 'FL'
      },
      someOtherThing: {
        nested: index
      }
    }));
}
