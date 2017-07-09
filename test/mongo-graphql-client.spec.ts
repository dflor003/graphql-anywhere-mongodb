import gql from 'graphql-tag';
import { expect } from 'chai';
import { mongoTestServer } from './util/mongo-test-server';
import { Collection, Db } from 'mongodb';
import { MongoGraphQLClient } from '../src';
import { graphqlClient } from '../src/mongo-grqphql-client-factory';

describe('MongoGraphQLClient', () => {
  const server = mongoTestServer();
  let connection: Db;
  let users: Collection<any>;
  let collection2: Collection<any>;
  let client: MongoGraphQLClient;

  before(async () => {
    await server.start();
  });

  after(async () => {
    await server.stop();
  });

  beforeEach(async () => {
    connection = await server.getConnection('test-db');
    client = graphqlClient.forConnection(connection);
    users = await connection.collection('users');
    collection2 = await connection.collection('collection2');
  });

  afterEach(async () => {
    await connection.dropDatabase();
  });

  describe('findOne', () => {
    it('should find a matching document', async () => {
      // Arrange
      const docs = generateDocs(5);
      await users.insertMany(docs);

      const query = gql`
        {
          users {
            _id (eq: $id)
            name
            address {
              line1
              line2
            }
          }
        }
      `;

      // Act
      const results = await client.findOne(query, { id: 3 });

      // Assert
      expect(results).to.deep.equal({
        data: {
          users: {
            _id: 3,
            name: 'User 3',
            address: {
              line1: 'Something 3',
              line2: 'Other thing 3'
            }
          }
        },
        errors: undefined
      });
    });
  });

  describe('find', () => {
    it('should find multiple documents', async () => {
      // Arrange
      const docs = generateDocs(6);
      await users.insertMany(docs);

      const query = gql`
        {
          users {
            _id
            name
            age (gte: $age)
          }
        }
      `;

      // Act
      const results = await client.find(query, { age: 21 });

      // Assert
      expect(results.data.users.length).to.equal(3);
      expect(results.data.users).to.deep.equal([
        {
          _id: 4,
          name: 'User 4',
          age: 21,
        },
        {
          _id: 5,
          name: 'User 5',
          age: 22,
        },
        {
          _id: 6,
          name: 'User 6',
          age: 23,
        },
      ]);
    });

    describe('when using limit', () => {
      it('should limit returned results', async () => {
        // Arrange
        const docs = generateDocs(10);
        await users.insertMany(docs);

        const query = gql`
          {
            users (limit: 3) {
              _id
              name
            }
          }
        `;

        // Act
        const results = await client.find(query);

        // Assert
        expect(results.data.users.length).to.equal(3);
        expect(results.data.users).to.deep.equal([
          {
            _id: 1,
            name: 'User 1',
          },
          {
            _id: 2,
            name: 'User 2',
          },
          {
            _id: 3,
            name: 'User 3',
          },
        ]);
      });
    });
  });
});

function generateDocs(count: number): any[] {
  return Array
    .from(Array(count))
    .map((val, i) => i + 1)
    .map(index => ({
      _id: index,
      name: `User ${index}`,
      age: 17 + index,
      address: {
        line1: `Something ${index}`,
        line2: `Other thing ${index}`,
        city: 'Miami',
        state: 'FL',
        zip: 33173
      },
    }));
}
