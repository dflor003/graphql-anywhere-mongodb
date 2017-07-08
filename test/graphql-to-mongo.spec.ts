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

  it('should support limit and skip at the root', () => {
    // Arrange
    const query = gql`
      {
        users (limit: $limit, skip: $offset) {
          firstName
          lastName
        }
      }
    `;

    // Act
    const result = graphqlToMongo(query, { limit: 100, offset: 10 });

    // Assert
    expect(result).to.deep.equal([
      {
        collection: 'users',
        limit: 100,
        skip: 10,
        query: {},
        fields: {
          'firstName': 1,
          'lastName': 1,
        }
      }
    ]);
  });

  it('should not support arguments inside a document', () => {
    // Arrange
    const query = gql`
      {
        users {
          firstName
          lastName
          addresses (limit: 20) {
            city
            state
          }
        }
      }
    `;

    // Act / Assert
    expect(() => graphqlToMongo(query)).to.throw(`Arguments are not supported at sub-document level`);
  });

  it(`should not support collection level arguments that don't make sense`, () => {
    // Arrange
    const query = gql`
      {
        users (foo: "Bar") {
          firstName
          lastName
        }
      }
    `;

    // Act / Assert
    expect(() => graphqlToMongo(query)).to.throw(`Argument 'foo' is not a valid collection-level argument.`);
  });

  it(`should not support field level arguments that don't make sense`, () => {
    // Arrange
    const query = gql`
      {
        users  {
          firstName (derp: "Bar")
          lastName
        }
      }
    `;

    // Act / Assert
    expect(() => graphqlToMongo(query)).to.throw(`Argument 'derp' is not a valid field-level argument.`);
  });
});
