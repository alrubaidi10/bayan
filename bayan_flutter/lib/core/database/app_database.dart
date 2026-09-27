import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import 'package:uuid/uuid.dart';

class AppDatabase {
  static final AppDatabase instance = AppDatabase._init();
  static Database? _database;

  AppDatabase._init();

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDB('bayan_erp.db');
    return _database!;
  }

  Future<Database> _initDB(String filePath) async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, filePath);

    return await openDatabase(
      path,
      version: 1,
      onCreate: _createDB,
    );
  }

  Future _createDB(Database db, int version) async {
    const uuid = Uuid();

    // 1. Companies & Settings
    await db.execute('''
      CREATE TABLE companies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        baseCurrency TEXT NOT NULL DEFAULT 'USD',
        taxEnabled INTEGER NOT NULL DEFAULT 0,
        taxRate REAL NOT NULL DEFAULT 0.0,
        plan TEXT NOT NULL DEFAULT 'active',
        status TEXT NOT NULL DEFAULT 'active',
        subscriptionStart TEXT,
        subscriptionEnd TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        syncStatus TEXT NOT NULL DEFAULT 'pending'
      )
    ''');

    // 2. Users & RBAC
    await db.execute('''
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        companyId TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        passwordHash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'admin',
        isSuperAdmin INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        syncStatus TEXT NOT NULL DEFAULT 'pending'
      )
    ''');

    // 3. Accounts (Chart of Accounts)
    await db.execute('''
      CREATE TABLE accounts (
        id TEXT PRIMARY KEY,
        companyId TEXT NOT NULL,
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        nameAr TEXT NOT NULL,
        type TEXT NOT NULL,
        parentAccountId TEXT,
        isActive INTEGER NOT NULL DEFAULT 1,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        syncStatus TEXT NOT NULL DEFAULT 'pending'
      )
    ''');

    // 4. Journal Entries & Lines (Double Entry Accounting)
    await db.execute('''
      CREATE TABLE journal_entries (
        id TEXT PRIMARY KEY,
        companyId TEXT NOT NULL,
        entryNumber TEXT NOT NULL,
        date TEXT NOT NULL,
        memo TEXT,
        reference TEXT,
        source TEXT NOT NULL DEFAULT 'manual',
        sourceId TEXT,
        posted INTEGER NOT NULL DEFAULT 1,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        syncStatus TEXT NOT NULL DEFAULT 'pending'
      )
    ''');

    await db.execute('''
      CREATE TABLE journal_entry_lines (
        id TEXT PRIMARY KEY,
        entryId TEXT NOT NULL,
        accountId TEXT NOT NULL,
        debit REAL NOT NULL DEFAULT 0.0,
        credit REAL NOT NULL DEFAULT 0.0,
        FOREIGN KEY (entryId) REFERENCES journal_entries (id) ON DELETE CASCADE
      )
    ''');

    // 5. Customers & Suppliers
    await db.execute('''
      CREATE TABLE contacts (
        id TEXT PRIMARY KEY,
        companyId TEXT NOT NULL,
        kind TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        address TEXT,
        taxNo TEXT,
        currency TEXT,
        creditLimit REAL DEFAULT 0.0,
        openingBalance REAL DEFAULT 0.0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        syncStatus TEXT NOT NULL DEFAULT 'pending'
      )
    ''');

    // 6. Products & Inventory
    await db.execute('''
      CREATE TABLE products (
        id TEXT PRIMARY KEY,
        companyId TEXT NOT NULL,
        name TEXT NOT NULL,
        nameAr TEXT,
        sku TEXT,
        barcode TEXT,
        category TEXT,
        unit TEXT DEFAULT 'pcs',
        cost REAL NOT NULL DEFAULT 0.0,
        price REAL NOT NULL DEFAULT 0.0,
        stock REAL NOT NULL DEFAULT 0.0,
        reorderLevel REAL NOT NULL DEFAULT 0.0,
        isActive INTEGER NOT NULL DEFAULT 1,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        syncStatus TEXT NOT NULL DEFAULT 'pending'
      )
    ''');

    // 7. Sales & Purchases Invoices
    await db.execute('''
      CREATE TABLE invoices (
        id TEXT PRIMARY KEY,
        companyId TEXT NOT NULL,
        kind TEXT NOT NULL,
        number TEXT NOT NULL,
        contactId TEXT,
        date TEXT NOT NULL,
        dueDate TEXT,
        currency TEXT NOT NULL DEFAULT 'USD',
        fxRate REAL NOT NULL DEFAULT 1.0,
        subtotal REAL NOT NULL DEFAULT 0.0,
        taxAmount REAL NOT NULL DEFAULT 0.0,
        total REAL NOT NULL DEFAULT 0.0,
        status TEXT NOT NULL DEFAULT 'draft',
        memo TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        syncStatus TEXT NOT NULL DEFAULT 'pending'
      )
    ''');

    await db.execute('''
      CREATE TABLE invoice_items (
        id TEXT PRIMARY KEY,
        invoiceId TEXT NOT NULL,
        productId TEXT,
        description TEXT,
        qty REAL NOT NULL DEFAULT 1.0,
        unitPrice REAL NOT NULL DEFAULT 0.0,
        amount REAL NOT NULL DEFAULT 0.0,
        baseAmount REAL NOT NULL DEFAULT 0.0,
        FOREIGN KEY (invoiceId) REFERENCES invoices (id) ON DELETE CASCADE
      )
    ''');

    // 8. Offline Sync Queue
    await db.execute('''
      CREATE TABLE sync_queue (
        id TEXT PRIMARY KEY,
        tableName TEXT NOT NULL,
        recordId TEXT NOT NULL,
        operation TEXT NOT NULL,
        dataJson TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        retryCount INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL
      )
    ''');

    // 9. Audit Logs
    await db.execute('''
      CREATE TABLE audit_logs (
        id TEXT PRIMARY KEY,
        companyId TEXT NOT NULL,
        userId TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT NOT NULL,
        timestamp TEXT NOT NULL
      )
    ''');
  }

  Future<void> close() async {
    final db = await instance.database;
    db.close();
  }
}
