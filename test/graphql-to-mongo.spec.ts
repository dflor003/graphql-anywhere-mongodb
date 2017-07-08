import gql from 'graphql-tag';
import { expect } from 'chai';
import { graphqlToMongo } from '../src/graphql-to-mongo';
import { log } from './log';

describe('GraphQL to Mongo', () => {
  it('should support simple queries', () => {
    // Arrange
    const query = gql`
      {
        myCollection {
          type (eq: "foo.bar.Baz")
          body {
            id
            tenantId (eq: "something")
            name
          }
        }
      }
    `;

    // Act
    const result = graphqlToMongo(query);

    // Assert
    expect(result).to.deep.equal([
      {
        collection: 'myCollection',
        query: {
          'type': { '$eq': 'foo.bar.Baz' },
          'body.tenantId': { $eq: 'something' }
        },
        projection: ['type', 'body.id', 'body.tenantId', 'body.name']
      }
    ]);
  });

  it('should support variables', () => {
    // Arrange
    const query = gql`
      {
        myOtherCollection {
          outerField {
            nestedField (eq: $myVar)
          }
        }
      }
    `;

    // Act
    const result = graphqlToMongo(query, { myVar: 42 });

    // Assert
    expect(result).to.deep.equal([
      {
        collection: 'myOtherCollection',
        query: {
          'outerField.nestedField': { $eq: 42 }
        },
        projection: ['outerField.nestedField']
      }
    ])
  });
});
