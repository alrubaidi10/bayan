import 'dart:async';
import 'dart:convert';
import 'package:sqflite/sqflite.dart';
import 'package:uuid/uuid.dart';
import '../database/app_database.dart';

enum SyncStatus { pending, syncing, synced, failed }

class SyncService {
  static final SyncService instance = SyncService._init();
  Timer? _syncTimer;
  bool _isSyncing = false;

  SyncService._init();

  void startAutoSync() {
    _syncTimer?.cancel();
    _syncTimer = Timer.periodic(const Duration(seconds: 15), (_) => triggerSync());
  }

  void stopAutoSync() {
    _syncTimer?.cancel();
  }

  Future<void> enqueueOperation({
    required String tableName,
    required String recordId,
    required String operation, // 'INSERT', 'UPDATE', 'DELETE'
    required Map<String, dynamic> data,
  }) async {
    final db = await AppDatabase.instance.database;
    final uuid = const Uuid().v4();

    await db.insert(
      'sync_queue',
      {
        'id': uuid,
        'tableName': tableName,
        'recordId': recordId,
        'operation': operation,
        'dataJson': jsonEncode(data),
        'status': 'pending',
        'retryCount': 0,
        'createdAt': DateTime.now().toIso8601String(),
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );

    // Attempt immediate sync if possible
    triggerSync();
  }

  Future<void> triggerSync() async {
    if (_isSyncing) return;
    _isSyncing = true;

    try {
      final db = await AppDatabase.instance.database;
      final pendingOps = await db.query(
        'sync_queue',
        where: 'status = ?',
        whereArgs: ['pending'],
        orderBy: 'createdAt ASC',
        limit: 50,
      );

      if (pendingOps.isEmpty) {
        _isSyncing = false;
        return;
      }

      for (var op in pendingOps) {
        final id = op['id'] as String;
        final tableName = op['tableName'] as String;
        final recordId = op['recordId'] as String;
        final operation = op['operation'] as String;
        final data = jsonDecode(op['dataJson'] as String) as Map<String, dynamic>;

        try {
          // Here: Sync to Cloud Firestore when network is online
          // Firestore.instance.collection(tableName).doc(recordId).set(data)

          // Mark as synced in SQFlite
          await db.update(
            'sync_queue',
            {'status': 'synced'},
            where: 'id = ?',
            whereArgs: [id],
          );

          await db.update(
            tableName,
            {'syncStatus': 'synced'},
            where: 'id = ?',
            whereArgs: [recordId],
          );
        } catch (e) {
          // Retry counter & error handling
          int retries = (op['retryCount'] as int) + 1;
          await db.update(
            'sync_queue',
            {
              'status': retries > 5 ? 'failed' : 'pending',
              'retryCount': retries,
            },
            where: 'id = ?',
            whereArgs: [id],
          );
        }
      }
    } finally {
      _isSyncing = false;
    }
  }
}
