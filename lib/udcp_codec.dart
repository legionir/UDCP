// lib/udcp_codec.dart
import 'dart:isolate';
import 'dart:typed_data';

class BinaryDecoder {
  static Map<String, dynamic>? decodeMotion(Uint8List data) {
    if (data.length != 36) return null;
    final buf = ByteData.sublistView(data);
    return {
      'version': data[0],
      'type': data[1],
      'seq': buf.getUint16(2, Endian.little),
      'ts': buf.getUint32(4, Endian.little),
      'ax': buf.getFloat32(8, Endian.little),
      'ay': buf.getFloat32(12, Endian.little),
      'az': buf.getFloat32(16, Endian.little),
      'gx': buf.getFloat32(20, Endian.little),
      'gy': buf.getFloat32(24, Endian.little),
      'gz': buf.getFloat32(28, Endian.little),
    };
  }
}

// lib/udcp_fsm.dart
enum ConnectionState { disconnected, connecting, connected, error, reconnecting }

class ConnectionFSM {
  ConnectionState state = ConnectionState.disconnected;
  int retryCount = 0;
  final int maxRetries = 5;
  
  void transition(ConnectionState newState) {
    print('[FSM] $state -> $newState');
    state = newState;
    if (newState == ConnectionState.connected) retryCount = 0;
  }
  
  Duration getRetryDelay() => Duration(seconds: min(30, pow(2, retryCount).toInt()));
  bool canRetry() => retryCount < maxRetries;
}
