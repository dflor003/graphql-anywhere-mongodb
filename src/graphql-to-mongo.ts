import graphql from 'graphql-anywhere';
import { ExecInfo } from 'graphql-anywhere';
import { DocumentNode } from 'graphql';
import { DirectiveInfo } from 'graphql-anywhere/lib/src/directives';

const { keys } = Object;

export type QueryMap = {
  [key: string]: any;
  path: string[];
  isQuery: boolean;
};

export interface MongoQueryInfo {
  collection: string;
  limit?: number;
  skip?: number;
  query: QueryMap;
  fields: QueryMap;
}

interface FieldMetaData {
  directives?: DirectiveInfo;
  args?: any;
  [key: string]: any;
}

interface ResolveContext {
  [path: string]: FieldMetaData;
}

// Arguments that are only valid for the entire collection
export const ValidCollectionArgs = ['limit', 'skip'];
const validateCollectionArgs = (args: any) => keys(args)
  .filter(arg => !ValidCollectionArgs.includes(arg))
  .forEach(arg => {
    throw new Error(`Argument '${arg}' is not a valid collection-level argument.`);
  });

// Arguments that are only valid for non-leaf nodes
export const ValidNonLeafArguments = ['include'];
const validateNonLeafArgs = (args: any) => keys(args)
  .filter(arg => !ValidNonLeafArguments.includes(arg))
  .forEach(arg => {
    throw new Error(`Argument '${arg}' is not a valid non-leaf-level argument.`);
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
  const context: ResolveContext = {};
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
      const extraParams: FieldMetaData = context[collection].args || <any>{};
      keys(extraParams).forEach(key => baseQuery[key] = extraParams[key]);

      return <MongoQueryInfo>baseQuery;
    });

  // Process each collection subtree to discover how the mongo query should look
  queries
    .forEach(queryInfo => buildQuery(result[queryInfo.collection], [], queryInfo, context));

  return queries;
}

function resolve(fieldName: string, rootValue: any, args: any, context: ResolveContext, info: ExecInfo): QueryMap {
  // Calculate path to field
  const path = [
    ...(rootValue && rootValue.path
      ? rootValue.path
      : []),
    fieldName
  ];
  const pathKey = path.join('.');

  // Attach metadata
  context[pathKey] = {
    directives: info.directives || {},
    args: args || {},
  };

  // Check for args at the collection level like limit & skip
  if (!rootValue && args) {
    validateCollectionArgs(args);
  }

  // Error if applying args to anything other than the collection
  // TODO: Support array field types
  if (rootValue && !info.isLeaf && args) {
    validateNonLeafArgs(args);
  }

  // Validate leaf args if present
  if (info.isLeaf && args) {
    validateLeafArguments(args);
  }

  return <QueryMap>keys(args || {})
    .reduce((obj: QueryMap, arg: any) => ({
      ...obj,
      [arg]: args[arg]
    }), {
      path,
      isQuery: true,
    });
}

function buildQuery(node: QueryMap, parents: string[], queryInfo: MongoQueryInfo, context: ResolveContext, ancestorProjected = false): void {
  if (!node) {
    return;
  }

  const parentPath = parents.join('.');
  for (const field of keys(node)) {
    const value = node[field];
    const path = [...parents, field];
    const fieldPath = path.join('.');
    const metaData = context[`${queryInfo.collection}.${fieldPath}`];

    // Apply projection
    if (!ancestorProjected && metaData.args.include === true) {
      queryInfo.fields[fieldPath] = 1;
      ancestorProjected = true;
    }

    // Process leaf queries
    if (value && value.isQuery) {
      const queryKeys = keys(value).filter(key => !['isQuery', 'path'].includes(key));
      queryKeys.forEach(queryKey => {
        const fieldQuery = queryInfo.query[fieldPath] = queryInfo.query[fieldPath] || {};
        fieldQuery[`$${queryKey}`] = value[queryKey];
      });

      // Add leaf fields to projection
      if (!ancestorProjected) {
        queryInfo.fields[fieldPath] = 1;
      }
    } else if (value && keys(value).length > 0) {
      // Recursively process children for nested objects
      buildQuery(value, path, queryInfo, context, ancestorProjected);
    }
  }
}
