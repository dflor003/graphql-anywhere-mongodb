import gql from 'graphql-tag';
import { expect } from 'chai';
import { graphqlToMongo } from '../src/graphql-to-mongo';

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
        fields: {
          'type': 1,
          'body.id': 1,
          'body.tenantId': 1,
          'body.name': 1,
        }
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
        fields: {
          'outerField.nestedField': 1
        }
      }
    ])
  });
});
