import * as MongoInMemory from 'mongo-in-memory';
import { Db } from 'mongodb';


export class MongoTestServer {
  isRunning = false;
  server: any;

  constructor(port?: number) {
    this.server = new MongoInMemory(port);
  }

  start(): Promise<any> {
    return new Promise((resolve, reject) => {
      this.server.start((error: Error, config: any) => {
        if (error) {
          reject(error);
        } else {
          this.isRunning = true;
          resolve(config);
        }
      });
    });
  }

  getMongoUri(database: string): string {
    if (!this.isRunning) {
      throw new Error(`Server is not started`);
    }

    return this.server.getMongouri(database);
  }

  getConnection(database: string): Promise<Db> {
    return new Promise((resolve, reject) => {
      this.server.getConnection(database, (error: Error, conn: Db) => {
        if (error) {
          reject(error);
        } else {
          resolve(conn);
        }
      })
    });
  }

  stop(): Promise<any> {
    return new Promise((resolve, reject) => {
      this.server.stop((error:Error) => {
        if (error) {
          reject(error);
        } else {
          this.isRunning = false;
          resolve();
        }
      })
    });
  }
}

export function mongoTestServer(port?: number): MongoTestServer {
  return new MongoTestServer(port);
}
