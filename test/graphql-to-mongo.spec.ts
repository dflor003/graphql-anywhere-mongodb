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
        },
        sort: {},
      }
    ]);
  });

  it('should support case-insensitive regex queries', () => {
    // Arrange
    const query = gql`
      {
        myCollection {
          type (regex: "someTHING", options: "i")
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
          'type': { $regex: 'someTHING', $options: 'i' },
        },
        fields: {
          'type': 1,
        },
        sort: {},
      }
    ]);
  });

  it('should support variables', () => {
    // Arrange
    const query = gql`
      query myQuery (
        $search: String!
        $limit: Int
        $offset: Int
      ) {
        events(limit: $limit, skip: $offset) {
          type(regex: $search)
          timestamp
          body
        }
      }
    `;

    // Act
    const result = graphqlToMongo(query, {
      search: 'foo.bar',
      limit: 20,
      offset: 10
    });

    // Assert
    expect(result).to.deep.equal([
      {
        collection: 'events',
        query: {
          'type': { $regex: 'foo.bar' }
        },
        fields: {
          type: 1,
          timestamp: 1,
          body: 1
        },
        limit: 20,
        skip: 10,
        sort: {},
      }
    ])
  });

  it('should not include undefined variables in query', () => {
    // Arrange
    const query = gql`
      query myQuery (
        $search: String!
        $tenantId: String!
        $limit: Int
        $offset: Int
      ) {
        events(limit: $limit, skip: $offset) {
          type(regex: $search)
          tenantId(eq: $tenantId)
          timestamp
          body
        }
      }
    `;

    // Act
    const result = graphqlToMongo(query, {
      search: 'foo.bar',
      limit: 10
    });

    // Assert
    expect(result).to.deep.equal([
      {
        collection: 'events',
        limit: 10,
        query: {
          type: { $regex: 'foo.bar' }
        },
        fields: {
          'type': 1,
          'tenantId': 1,
          'timestamp': 1,
          'body': 1,
        },
        sort: {},
      }
    ]);
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
        },
        sort: {},
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
    expect(() => graphqlToMongo(query)).to.throw(`Argument 'limit' is not a valid non-leaf-level argument`);
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

  it('should allow you to include an outer portion of the document while filtering inside it', () => {
    // Arrange
    const query = gql`
      {
        events {
          type
          outer {
            body(include: true) {
              inner {
                businessId(eq: "Foo")
              }
            }
          }
        }
      }
    `;

    // Act
    const result = graphqlToMongo(query);

    // Assert
    expect(result).to.deep.equal([
      {
        collection: 'events',
        sort: {},
        query: {
          'outer.body.inner.businessId': { $eq: 'Foo' }
        },
        fields: {
          'type': 1,
          'outer.body': 1,
        }
      }
    ]);
  });

  it('should support sorting by multiple fields', () => {
    // Arrange
    const query = gql`
      {
        events(limit: 10)  {
          timestamp @sort
          body(include: true) {
            otherField @sortDesc
            businessId(eq: "Bar")
          }
        }
      }
    `;

    // Act
    const result = graphqlToMongo(query);

    // Assert
    expect(result).to.deep.equal([
      {
        collection: 'events',
        limit: 10,
        query: {
          'body.businessId': { $eq: 'Bar' }
        },
        fields: {
          'timestamp': 1,
          'body': 1,
        },
        sort: {
          'timestamp': 1,
          'body.otherField': -1
        }
      }
    ]);
  });
});
