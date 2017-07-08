import { expect } from 'chai';
import gql from 'graphql-tag';
import { graphqlToMongo } from '../src/graphql-to-mongo';

describe('GraphQL to Mongo', () => {
  it('should support simple queries', () => {
    // Arrange
    const query = gql`
      {
        result (type: "foo.bar.Baz") {
          type
          body (tenantId: "something") {
            id
            tenantId
            name
          }
        }
      }
    `;

    // Act
    const result = graphqlToMongo(query);

    // Assert
    expect(result).to.deep.equal({
      'type': 'foo.bar.Baz',
      'body.tenantId': 'something'
    });
  });
});
