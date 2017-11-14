# graphql-anywhere-mongodb

**WARNING:** This repo is just an experiment, do not use this in production yet.

A library based off [graphql-anywhere](https://github.com/apollographql/graphql-anywhere) that lets you use schemaless GraphQL queries to query documents across one or more MongoDB collections. Use it together with [graphql-tag](https://github.com/apollographql/graphql-tag).

Install using npm:

```sh
npm install --save graphql-tag graphql-anhywhere-mongodb
```

Or using yarn:

```sh
yarn add graphql-tag graphql-anywhere-mongodb
```

## Example App

Wanna take this for a spin? See the [graphql-anywhere-mongodb-example](https://github.com/dflor003/graphql-anywhere-mongodb-example) repo for instructions on how to plug this in with [graphql-anywhere-mongodb-express](https://github.com/dflor003/graphql-anywhere-mongodb-express) to be able to make queries into MongoDB using GraphiQL.

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

## Examples

### Querying one or more collections

Top level objects correspond to collections. You can query one or more collections in a single graphql query. For example, assuming we have a collection `users` and `places`, we can make the following query:

```graphql
# Return firstName and lastName from users
# AND also return name from places
{
  users {
    firstName
    lastName
  }
  places {
    name
  }
}
```

### Projection

Every field name listed will be included in the final projection that you get from MongoDB. This works on nested objects AND arrays. The MongoDB `_id` field is always returned.

```graphql
{
  users {
    firstName
    lastName
    address {
      line1
      line2
      city
      state
      zip
    }
    favoritePlaces {
      name
      gps {
        lat
        lng
      }
    }
  }
}
```

In cases where you need to filter on a nested object but project the entire outer document you may add `include: true` to the parent document to include it in its entirety. For example, given the same schema as the above query, this would return the entire `address` sub-document, even though we only explicitly call out `zip`:

```graphql
{
  users {
    firstName
    lastName
    address (include: true) {
      zip (eq: "33326")
    }
  }
}
```

### Limit/Skip

You can add a top-level argument for `limit` and/or `skip` to pass those arguments along to the final mongodb query.

```graphql
{
  users (limit: 10, skip 0) {
    firstName
    lastName
  }
}
```

### Filters

Use standard MongoDB filters like `$eq`, `$ne`, `$gt`, `$gte`, etc. without the `$` prefix as part of your GraphQL query to add filters to your query. See the [MongoDB Docs](https://docs.mongodb.com/manual/reference/operator/query/) for the full list of valid filters.

**Note:** Array filters like `$elemMatch` are not currently supported.

```graphql
{
  users (limit: 10, skip: 0) {
    firstName
    lastName
    age (gte: 21)
    address {
      city (eq: "Miami")
      state (eq: "Florida")
    }
  }
}
```

## TODO List

- [X] Support basic querying capabilities against MongoDB Collections.
- [X] Support collection-level things like `limit` and `skip`.
- [ ] Support other collection-level things like sorting.
- [X] Support querying on an inner nexted document while projecting the entire document.
- [ ] Support more complex data types
- [X] Support projection of arrays inside documents.
- [ ] Support filtering of arrays inside documents.
- [X] GraphiQL-like example to test this against arbitrary MongoDB instances.
- [ ] Support mutating documents
- [ ] Support inserting documents
