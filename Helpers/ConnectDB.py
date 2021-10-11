import pymysql

class DbUtil:
	@staticmethod
	def get_connection() -> pymysql.connect:
		try:
			db = pymysql.connect(host='localhost', user='root', password='', db='py_site', cursorclass=pymysql.cursors.DictCursor)
		except (pymysql.err.OperationalError, pymysql.ProgrammingError, pymysql.InternalError, pymysql.IntegrityError, TypeError) as error:
			print("BD NON CONNECTEE, Il y a une ERREUR : %s", error)
			print('Exception number: {}, value {!r}'.format(error.args[0], error))
		else:
			return db
