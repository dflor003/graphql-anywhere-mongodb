import graphql from 'graphql-anywhere';
import { ExecInfo } from 'graphql-anywhere';
import { DocumentNode } from 'graphql';

const { keys } = Object;

export type QueryMap = { [key: string]: any; };

export interface MongoQueryInfo {
  collection: string;
  limit?: number;
  skip?: number;
  query: QueryMap;
  fields: QueryMap;
}

// Arguments that are only valid for the entire collection
export const ValidCollectionArgs = ['limit', 'skip'];
const validateCollectionArgs = (args: any) => keys(args)
  .filter(arg => !ValidCollectionArgs.includes(arg))
  .forEach(arg => {
    throw new Error(`Argument '${arg}' is not a valid collection-level argument.`);
  });

// Arguments that are valid for any leaf
export const ValidLeafArguments = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'exists', 'regex'];
const validateLeafArguments = (args: any) => keys(args)
  .filter(arg => !ValidLeafArguments.includes(arg))
  .forEach(arg => {
    throw new Error(`Argument '${arg}' is not a valid field-level argument.`);
  });


export function graphqlToMongo(query: DocumentNode, variables?: object): MongoQueryInfo[] {
  // Use resolver to build an intermediate model of how the mongo query will look
  const context: any = {};
  const result = graphql(resolve, query, null, context, variables);

  // Build data structure to hold query info
  const queries = keys(result)
    .map(collection => {
      const baseQuery: any = {
        collection,
        query: {},
        fields: {}
      };

      // Add on any extra parameters like limit, skip, sort, etc.
      const extraParams = context[collection] || {};
      keys(extraParams).forEach(key => baseQuery[key] = extraParams[key]);

      return <MongoQueryInfo>baseQuery;
    });

  // Process each collection subtree to discover how the mongo query should look
  queries
    .forEach(queryInfo => buildQuery(result[queryInfo.collection], [], queryInfo));

  return queries;
}

function resolve(fieldName: string, rootValue: any, args: any, context: any, info: ExecInfo): QueryMap {
  // Check for args at the collection level like limit & skip
  if (!rootValue && args) {
    validateCollectionArgs(args);
    context[fieldName] = args;
  }

  // Error if applying args to anything other than the collection
  // TODO: Support array field types
  if (rootValue && !info.isLeaf && args) {
    throw new Error(`Arguments are not supported at sub-document level`);
  }

  // Validate leaf args if present
  if (info.isLeaf && args) {
    validateLeafArguments(args);
  }

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
      queryInfo.fields[fieldPath] = 1;
    } else if (keys(value).length > 0) {
      // Recursively process children for nested objects
      buildQuery(value, path, queryInfo);
    }
  }
}
