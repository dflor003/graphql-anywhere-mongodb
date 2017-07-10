import * as chaiAsPromised from 'chai-as-promised';
import gql from 'graphql-tag';
import { expect, use } from 'chai';
import { mongoTestServer } from './util/mongo-test-server';
import { Collection, Db } from 'mongodb';
import { MongoGraphQLClient } from '../src';
import { graphqlClient } from '../src/mongo-grqphql-client-factory';

use(chaiAsPromised);

describe('MongoGraphQLClient', () => {
  const server = mongoTestServer();
  let connection: Db;
  let users: Collection<any>;
  let cities: Collection<any>;
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
    cities = await connection.collection('cities');
  });

  afterEach(async () => {
    await connection.dropDatabase();
  });

  describe('findOne', () => {
    it('should throw an error if null document', async () => {
      // Act / Assert
      await expect(client.findOne(null)).to.be.rejectedWith('Must pass either document or string');
    });

    it('should find a matching document', async () => {
      // Arrange
      const docs = generateUsers(5);
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
    beforeEach(async() => {
      const docs = generateUsers(6);
      await users.insertMany(docs);

      const cityDocs = [
        {
          _id: 1,
          name: 'Miami'
        },
        {
          _id: 2,
          name: 'Ft. Lauderdale'
        },
        {
          _id: 3,
          name: 'Tampa'
        },
      ];
      await cities.insertMany(cityDocs);
    });

    it('should throw an error if null document', async () => {
      // Act / Assert
      await expect(client.find(null)).to.be.rejectedWith('Must pass either document or string');
    });

    it('should find multiple documents', async () => {
      // Arrange
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

    it('should find multiple documents across multiple collections', async () => {
      // Arrange
      const query = gql`
        {
          users {
            _id
            name
          }
          cities {
            _id
            name
          }
        }
      `;

      // Act
      const results = await client.find(query);

      // Assert
      expect(results.data.users.length).to.equal(6);
      expect(results.data.cities.length).to.equal(3);
      expect(results.data.cities).to.deep.equal([
        {
          _id: 1,
          name: 'Miami'
        },
        {
          _id: 2,
          name: 'Ft. Lauderdale'
        },
        {
          _id: 3,
          name: 'Tampa'
        }
      ]);
    });

    describe('when using limit', () => {
      it('should limit returned results', async () => {
        // Arrange
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

    describe('when using skip', () => {
      it('should offset result set', async () => {
        // Arrange
        const query = gql`
          {
            users (limit: 3, skip: 2) {
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
            _id: 3,
            name: 'User 3',
          },
          {
            _id: 4,
            name: 'User 4',
          },
          {
            _id: 5,
            name: 'User 5',
          },
        ]);
      });
    });

    describe('when whitelisting collections', () => {
      beforeEach(async () => {
        client = graphqlClient.forConnection(connection, {
          whitelist: ['users']
        });
      });

      it('should throw if trying to access non whitelisted collection', async () => {
        // Arrange
        const query = gql`
          {
            cities {
              _id
              name
            }
          }
        `;

        // Act
        await expect(client.find(query)).to.be.rejectedWith(`Can not query collection 'cities'`);
      });
    });
  });
});

function generateUsers(count: number): any[] {
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
