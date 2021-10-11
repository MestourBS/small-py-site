from typing import Any, Iterable
import pymysql
import pymysql.cursors
import sys
sys.path.append('./Helpers')
from Helpers import DbUtil

class BaseModel:
    def __init__(self, table: str, primary_key: str = 'id'):
        self._table = table
        self._primary_key = primary_key

    def _run(self, query: str):
        '''Executes a query

        Params
        ------
        query: str
            The query to execute

        Returns
        -------
        None|Any
            The result of the query, or None if it failed
        '''
        result = None

        try:
            connection = DbUtil.get_connection()
            cursor = connection.cursor()
            cursor.execute(query)
            result = cursor.fetchall()
            connection.commit()
        except (pymysql.err.OperationalError, pymysql.ProgrammingError, pymysql.InternalError, pymysql.IntegrityError, TypeError) as error:
            print(f'DB Error: {error}')
            print(f'Errored DB query: {query}')
        finally:
            connection.close()
            cursor.close()

        return result

    def insert(self, columns: list[str], *values: list[Any]):
        '''Inserts rows into the table

        Params
        ------
        columns: list[str]
            A list of columns to insert into
        *values: list[Any]
            The values to insert
            Must be in the same order as the columns

        Returns
        -------
        bool
            True on success, False on failure
        '''
        query = 'INSERT INTO ' + self._table
        # columns
        query += ' (' + ', '.join(columns) + ') '
        # values
        query += 'VALUES '
        def vals_map(row: list[Any]) -> str:
            return '(' + ', '.join(str(v) for v in row) + ')'
        query += ', '.join(map(vals_map, values))

        # Run
        result = self._run(query) is not None

        return result

    def insert_single(self, value: dict[str, Any]):
        '''Inserts a single value

        Params
        ------
        value: dict[str, Any]
            The value to insert

        Returns
        -------
        bool
            True on success, False on failure
        '''
        columns = list(value.keys())
        values = list(value.values())

        result = self.insert(columns, values)

        return result

    def get(self, columns: list[str] = ['*'], *conditions: str):
        '''Gets one or more rows from the table

        Params
        ------
        columns: list[str]
            List of columns to get
            Defaults to all
        *conditions: str
            Raw conditions to use
            Example: `'id = 1', 'name = "aaa"'`

        Returns
        -------
        list[Any]
            The database rows
        '''
        # Build query
        query = 'SELECT ' + ', '.join(columns)
        query += ' FROM ' + self._table

        if conditions:
            query += ' WHERE ' + ' AND '.join(conditions)

        # Run query
        result = self._run(query)

        return result or []

    def get_primary(self, primary_value, columns: list[str] = ['*'], *conditions: str):
        '''Gets one or more rows from the table by using ids

        Params
        ------
        primary_value: str|list[str]
            List of primary keys to add to the conditions
            Can also be a single one
        columns: list[str]
            List of columns to get
            Defaults to all
        *conditions: str
            Raw conditions to use
            Example: `'id = 1', 'name = "aaa"'`

        Returns
        -------
        list[Any]
            The database rows
        '''
        comp = '='
        cond = '{} {} {}'
        # If an array of primary values is passed, check with IN
        if isinstance(primary_value, Iterable):
            comp = 'IN'
            primary_value = '(' + ', '.join(str(i) for i in primary_value) + ')'
        cond = cond.format(self._primary_key, comp, primary_value)
        return self.get(columns, cond, *conditions)

    def update(self, columns: dict[str, Any], *conditions: str):
        '''Updates one or more rows in the table

        Params
        ------
        columns: dict[str, Any]
            Columns to update with new value
            The key must be the column name, and the value is the new value
        *conditions: str
            Raw conditions to use
            Example: `'id = 1', 'name = "aaa"'`

        Returns
        -------
        bool
            True on success, False on failure
        '''
        # Query
        query = 'UPDATE ' + self._table
        query += ' SET ' + ', '.join(f'{k} = "{v}"' for k,v in columns.items())
        if conditions:
            query += 'WHERE ' + ', '.join(conditions)

        result = self._run(query) is not None

        return result

    def update_primary(self, primary_value, columns: dict[str, Any], *conditions: str):
        '''Updates one or more rows in the table

        Params
        ------
        primary_value: str|list[str]
            List of primary keys to add to the conditions
            Can also be a single one
        columns: dict[str, Any]
            Columns to update with new value
            The key must be the column name, and the value is the new value
        *conditions: str
            Raw conditions to use
            Example: `'id = 1', 'name = "aaa"'`

        Returns
        -------
        bool
            True on success, False on failure
        '''
        comp = '='
        cond = '{} {} {}'
        # If an array of primary values is passed, check with IN
        if isinstance(primary_value, Iterable):
            comp = 'IN'
            primary_value = '(' + ', '.join(str(i) for i in primary_value) + ')'
        cond = cond.format(self._primary_key, comp, primary_value)
        return self.update(columns, cond, *conditions)

    def delete(self, *conditions: str):
        '''Deletes one or more rows in the table

        Params
        ------
        *conditions: str
            Raw conditions to use
            Example: `'id = 1', 'name = "aaa"'`

        Returns
        -------
        bool
            True on success, False on failure
        '''
        # Query
        query = 'DELETE FROM ' + self._table
        if conditions:
            query += ' WHERE ' + ' AND '.join(conditions)

        result = self._run(query) is not None

        return result

    def delete_primary(self, primary_value, *conditions: str):
        '''Deletes one or more rows in the table

        Params
        ------
        primary_value: str|list[str]
            List of primary keys to add to the conditions
            Can also be a single one
        *conditions: str
            Raw conditions to use
            Example: `'id = 1', 'name = "aaa"'`

        Returns
        -------
        bool
            True on success, False on failure
        '''
        comp = '='
        cond = '{} {} {}'
        # If an array of primary values is passed, check with IN
        if isinstance(primary_value, Iterable):
            comp = 'IN'
            primary_value = '(' + ', '.join(str(i) for i in primary_value) + ')'
        cond = cond.format(self._primary_key, comp, primary_value)
        return self.delete(cond, *conditions)
