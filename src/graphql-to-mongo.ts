import graphql from 'graphql-anywhere';
import { ExecInfo } from 'graphql-anywhere';
import { DocumentNode } from 'graphql';

const { keys } = Object;

export type QueryMap = { [key: string]: any; };

export interface MongoQueryInfo {
  collection: string;
  query: QueryMap;
  projection: string[];
}

export function graphqlToMongo(query: DocumentNode, variables?: object): MongoQueryInfo[] {
  // Use resolver to build an intermediate model of how the mongo query will look
  const result = graphql(resolve, query, null, null, variables);

  // Build data structure to hold query info
  const collectionNames = keys(result);
  const queries = collectionNames
    .map(collection => <MongoQueryInfo>({
      collection,
      query: {},
      projection: []
    }));

  // Process each collection subtree to discover how the mongo query should look
  queries
    .forEach(queryInfo => buildQuery(result[queryInfo.collection], [], queryInfo));

  return queries;
}

function resolve(fieldName: string, rootValue: any, args: any, context: any, info: ExecInfo): QueryMap {
  return <QueryMap>keys(args || {})
    .reduce((obj: QueryMap, arg: any) => ({
      ...obj,
      [arg]: args[arg]
    }), { isQuery: true });
}

function buildQuery(node: any, parents: string[], queryInfo: MongoQueryInfo): void {
  if (!node) {
    return;
  }

  for (const field of keys(node)) {
    const value = node[field];
    const path = [...parents, field];
    const fieldPath = path.join('.');

    // Skip if no value
    if (!value) {
      continue;
    }

    // Process leaf queries
    if (value.isQuery) {
      const queryKeys = keys(value).filter(key => key !== 'isQuery');
      queryKeys.forEach(queryKey => {
        const fieldQuery = queryInfo.query[fieldPath] = queryInfo.query[fieldPath] || {};
        fieldQuery[`$${queryKey}`] = value[queryKey];
      });

      // Add leaf fields to projection
      queryInfo.projection.push(fieldPath);
    } else if (keys(value).length > 0) {
      // Recursively process children for nested objects
      buildQuery(value, path, queryInfo);
    }
  }
}
