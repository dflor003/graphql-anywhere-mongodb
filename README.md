# graphql-anywhere-mongodb

**WARNING:** This repo is just an experiment, do not use this in production yet.

A library based off [graphql-anywhere](https://github.com/apollographql/graphql-anywhere) that lets you use schemaless GraphQL queries to query documents across one or more MongoDB collections. Use it together with [graphql-tag](https://github.com/apollographql/graphql-tag).

**NOTE:** Not published yet as this is a work in progress.

Install using npm:

```sh
npm install --save graphql-tag graphql-anhywhere-mongodb
```

Or using yarn:

```sh
yarn add graphql-tag graphql-anywhere-mongodb
```

## Usage

Use one of the factory functions to create a query executor and then call `find` or `findOne` with a GraphQL query that contains one or more queries around your mongo collections:

```js
import graphql from 'graphql-anywhere-mongodb';
import gql from 'graphql-tag';

async function doStuff() {
  // Can acquire a GraphQLMongoQueryExecutor by passing in a MongoDB URI
  // this will use the mongo driver to create its own connection
  const mongo = await graphql.forUri('mongodb://myhost:27017/myDatabase');

  // Alternatively you can use an existing mongo driver connection
  const myConnection = await fetchConnection();
  const mongo = graphql.forConnection(myConnection);

  // Then you can start querying mongodb using graphql queries and the
  // gql string template from the graphql-tag library
  const query = gql`
    {
      users (limit: $limit, skip: $offset) {
        firstName
        lastName
        age (gte: $age)
        lastLoggedIn (gt: $date)
        address {
          city
          state
          zip
        }
      }
    }
  `;
  const variables = {
    age: 21,
    limit: 100,
    offset: 0,
    date: new Date('2017-01-17T05:00:00.000Z')
  };
  const results = await mongo.find(query, variables);
}
```

## TODO List

- [X] Support basic querying capabilities against MongoDB Collections.
- [ ] Support collection-level things like `limit` and `skip`.
- [ ] Support projection/filtering of arrays inside documents.
- [ ] GraphiQL-like example to test this against arbitrary MongoDB instances.
