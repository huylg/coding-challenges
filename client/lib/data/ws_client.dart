import "dart:async";
import "dart:convert";
import "dart:io";

/// A lightweight WebSocket client for quiz messages.
class QuizWebSocketClient {
  WebSocket? _socket;
  final StreamController<Map<String, dynamic>> _messages =
      StreamController.broadcast();

  Stream<Map<String, dynamic>> get messages => _messages.stream;

  bool get isConnected => _socket != null;

  Future<void> connect({
    required Uri uri,
    void Function()? onDone,
    void Function(Object error)? onError,
  }) async {
    await close();
    try {
      final socket = await WebSocket.connect(uri.toString());
      _socket = socket;
      socket.listen(
        (data) => _handleData(data),
        onDone: () {
          _socket = null;
          onDone?.call();
        },
        onError: (Object error) {
          _socket = null;
          onError?.call(error);
        },
      );
    } catch (error) {
      _socket = null;
      onError?.call(error);
      rethrow;
    }
  }

  void send(Map<String, dynamic> message) {
    final socket = _socket;
    if (socket == null) {
      return;
    }
    socket.add(jsonEncode(message));
  }

  Future<void> close() async {
    final socket = _socket;
    if (socket == null) {
      return;
    }
    await socket.close();
    _socket = null;
  }

  void dispose() {
    _messages.close();
  }

  void _handleData(Object data) {
    if (data is! String) {
      return;
    }
    try {
      final decoded = jsonDecode(data);
      if (decoded is Map<String, dynamic>) {
        _messages.add(decoded);
      }
    } catch (_) {
      _messages.add({
        "type": "error",
        "code": "parse_error",
        "message": "Invalid server payload.",
      });
    }
  }
}
