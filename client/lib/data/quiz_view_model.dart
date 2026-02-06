import "dart:async";
import "dart:math";

import "package:flutter/foundation.dart";

import "../models/quiz_models.dart";
import "ws_client.dart";

/// Connection lifecycle states for the quiz session.
enum ConnectionStatus {
  disconnected,
  connecting,
  connected,
  error,
}

/// Holds quiz session state and coordinates WebSocket communication.
class QuizViewModel extends ChangeNotifier {
  QuizViewModel({QuizWebSocketClient? client})
      : _client = client ?? QuizWebSocketClient();

  static const int countdownDuration = 30;

  final QuizWebSocketClient _client;
  StreamSubscription<Map<String, dynamic>>? _subscription;
  Timer? _reconnectTimer;
  Timer? _countdownTimer;
  int _reconnectAttempts = 0;

  ConnectionStatus status = ConnectionStatus.disconnected;
  String? errorMessage;
  String? quizId;
  String? username;
  Uri? _serverUri;
  List<LeaderboardEntry> leaderboard = const [];
  QuestionMessage? currentQuestion;
  String? selectedOptionId;
  int remainingSeconds = countdownDuration;

  bool get isInSession => quizId != null && username != null;

  Future<void> joinQuiz({
    required String serverUrl,
    required String quizId,
    required String username,
  }) async {
    final trimmedQuizId = quizId.trim();
    final trimmedUsername = username.trim();
    final uri = _parseServerUri(serverUrl);
    if (trimmedQuizId.isEmpty || trimmedUsername.isEmpty || uri == null) {
      status = ConnectionStatus.error;
      errorMessage = "Provide a valid server URL, quiz ID, and username.";
      notifyListeners();
      return;
    }

    this.quizId = trimmedQuizId;
    this.username = trimmedUsername;
    _serverUri = uri;
    await _connectAndJoin();
  }

  void selectOption(String? optionId) {
    selectedOptionId = optionId;
    notifyListeners();
  }

  void submitSelectedAnswer() {
    if (!isInSession) {
      return;
    }
    final question = currentQuestion;
    final optionId = selectedOptionId;
    if (question == null || optionId == null || optionId.isEmpty) {
      return;
    }
    _cancelCountdown();
    _client.send({
      "type": "answer",
      "quizId": quizId,
      "username": username,
      "questionId": question.questionId,
      "optionId": optionId,
    });
    selectedOptionId = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _cancelCountdown();
    _reconnectTimer?.cancel();
    _subscription?.cancel();
    _client.close();
    _client.dispose();
    super.dispose();
  }

  Future<void> _connectAndJoin() async {
    final uri = _serverUri;
    if (uri == null || quizId == null || username == null) {
      return;
    }
    status = ConnectionStatus.connecting;
    errorMessage = null;
    notifyListeners();
    try {
      await _client.connect(
        uri: uri,
        onDone: _handleDisconnect,
        onError: _handleDisconnect,
      );
      await _subscription?.cancel();
      _subscription = _client.messages.listen(_handleMessage);
      _client.send({
        "type": "join",
        "quizId": quizId,
        "username": username,
      });
      status = ConnectionStatus.connected;
      _reconnectAttempts = 0;
      notifyListeners();
    } catch (error) {
      _handleDisconnect(error);
    }
  }

  void _handleDisconnect([Object? error]) {
    if (_serverUri == null || quizId == null || username == null) {
      status = ConnectionStatus.disconnected;
      notifyListeners();
      return;
    }
    status = ConnectionStatus.error;
    errorMessage = error == null ? "Connection closed." : error.toString();
    notifyListeners();
    _scheduleReconnect();
  }

  void _scheduleReconnect() {
    if (_reconnectTimer != null) {
      return;
    }
    _reconnectAttempts += 1;
    final delay = min(pow(2, _reconnectAttempts).toInt(), 30);
    _reconnectTimer = Timer(Duration(seconds: delay), () {
      _reconnectTimer = null;
      _connectAndJoin();
    });
  }

  void _handleMessage(Map<String, dynamic> message) {
    final type = message["type"];
    if (type == "leaderboard_update") {
      final update = LeaderboardUpdate.fromJson(message);
      leaderboard = update.leaderboard;
      notifyListeners();
      return;
    }
    if (type == "question") {
      final question = QuestionMessage.fromJson(message);
      currentQuestion = question;
      selectedOptionId = null;
      _startCountdown();
      notifyListeners();
      return;
    }
    if (type == "quiz_complete") {
      _cancelCountdown();
      currentQuestion = null;
      selectedOptionId = null;
      notifyListeners();
      return;
    }
    if (type == "error") {
      status = ConnectionStatus.error;
      errorMessage = message["message"]?.toString() ?? "Server error.";
      notifyListeners();
    }
  }

  void _startCountdown() {
    _cancelCountdown();
    remainingSeconds = countdownDuration;
    _countdownTimer = Timer.periodic(
      const Duration(seconds: 1),
      (_) {
        remainingSeconds -= 1;
        if (remainingSeconds <= 0) {
          remainingSeconds = 0;
          _cancelCountdown();
          _autoSubmitNoAnswer();
        }
        notifyListeners();
      },
    );
  }

  void _cancelCountdown() {
    _countdownTimer?.cancel();
    _countdownTimer = null;
  }

  /// Sends an answer with an empty optionId when the countdown
  /// expires, letting the server treat it as an incorrect answer.
  void _autoSubmitNoAnswer() {
    final question = currentQuestion;
    if (!isInSession || question == null) {
      return;
    }
    _client.send({
      "type": "answer",
      "quizId": quizId,
      "username": username,
      "questionId": question.questionId,
      "optionId": "",
    });
    selectedOptionId = null;
  }

  Uri? _parseServerUri(String serverUrl) {
    try {
      final uri = Uri.parse(serverUrl.trim());
      if (uri.scheme != "ws" && uri.scheme != "wss") {
        return null;
      }
      return uri;
    } catch (_) {
      return null;
    }
  }
}
