declare module 'sql.js' {
  export interface Database {
    run(sql: string, params?: any[]): void;
    exec(sql: string): void;
    prepare(sql: string): Statement;
    export(): Uint8Array;
    getRowsModified(): number;
  }

  export interface Statement {
    bind(params?: any[]): void;
    step(): boolean;
    getAsObject(params?: any): any;
    free(): void;
  }

  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number>) => Database;
  }

  export default function initSqlJs(config?: any): Promise<SqlJsStatic>;
}