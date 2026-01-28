import "dart:async";

import "package:flutter_test/flutter_test.dart";

import "package:realtime_quiz_client/data/quiz_view_model.dart";
import "package:realtime_quiz_client/data/ws_client.dart";

class FakeQuizWebSocketClient implements QuizWebSocketClient {
  final StreamController<Map<String, dynamic>> _messages =
      StreamController.broadcast();

  final List<Map<String, dynamic>> sentMessages = [];
  bool connected = false;
  bool shouldFailConnect = false;

  void Function()? _onDone;
  void Function(Object error)? _onError;

  @override
  Stream<Map<String, dynamic>> get messages => _messages.stream;

  @override
  bool get isConnected => connected;

  @override
  Future<void> connect({
    required Uri uri,
    void Function()? onDone,
    void Function(Object error)? onError,
  }) async {
    _onDone = onDone;
    _onError = onError;
    if (shouldFailConnect) {
      final error = Exception("connect failed");
      onError?.call(error);
      throw error;
    }
    connected = true;
  }

  @override
  void send(Map<String, dynamic> message) {
    sentMessages.add(message);
  }

  @override
  Future<void> close() async {
    connected = false;
    _onDone?.call();
  }

  @override
  void dispose() {
    _messages.close();
  }

  void emitMessage(Map<String, dynamic> message) {
    _messages.add(message);
  }

  void emitError(Object error) {
    _onError?.call(error);
  }

  void emitDone() {
    _onDone?.call();
  }
}

Future<void> _flushMicrotasks() async {
  await Future<void>.delayed(Duration.zero);
}

void main() {
  test("QuizViewModel starts disconnected", () {
    final client = FakeQuizWebSocketClient();
    final model = QuizViewModel(client: client);

    expect(model.status, ConnectionStatus.disconnected);
    expect(model.isInSession, false);
  });

  test("joinQuiz validates input", () async {
    final client = FakeQuizWebSocketClient();
    final model = QuizViewModel(client: client);

    await model.joinQuiz(
      serverUrl: "http://localhost:3000",
      quizId: "",
      username: "",
    );

    expect(model.status, ConnectionStatus.error);
    expect(model.errorMessage, isNotEmpty);
  });

  test("joinQuiz connects and sends join message", () async {
    final client = FakeQuizWebSocketClient();
    final model = QuizViewModel(client: client);

    await model.joinQuiz(
      serverUrl: "ws://localhost:3000",
      quizId: " quiz-1 ",
      username: " alice ",
    );

    expect(model.status, ConnectionStatus.connected);
    expect(client.isConnected, true);
    expect(model.quizId, "quiz-1");
    expect(model.username, "alice");
    const expectedJoinMessage = {
      "type": "join",
      "quizId": "quiz-1",
      "username": "alice",
    };
    expect(client.sentMessages.single, expectedJoinMessage);
  });

  test("submitSelectedAnswer sends answer payload", () async {
    final client = FakeQuizWebSocketClient();
    final model = QuizViewModel(client: client);

    await model.joinQuiz(
      serverUrl: "ws://localhost:3000",
      quizId: "quiz-1",
      username: "alice",
    );

    client.emitMessage({
      "type": "question",
      "quizId": "quiz-1",
      "questionId": "q1",
      "prompt": "What is 1 + 1?",
      "options": [
        {"id": "q1_a", "text": "1"},
        {"id": "q1_b", "text": "2"},
        {"id": "q1_c", "text": "3"},
        {"id": "q1_d", "text": "4"},
      ],
    });
    await _flushMicrotasks();

    model.selectOption("q1_b");
    model.submitSelectedAnswer();

    const expectedAnswerMessage = {
      "type": "answer",
      "quizId": "quiz-1",
      "username": "alice",
      "questionId": "q1",
      "optionId": "q1_b",
    };
    expect(client.sentMessages.last, expectedAnswerMessage);
  });

  test("leaderboard update updates view model state", () async {
    final client = FakeQuizWebSocketClient();
    final model = QuizViewModel(client: client);

    await model.joinQuiz(
      serverUrl: "ws://localhost:3000",
      quizId: "quiz-1",
      username: "alice",
    );

    client.emitMessage({
      "type": "leaderboard_update",
      "quizId": "quiz-1",
      "leaderboard": [
        {"username": "alice", "score": 2},
      ],
    });
    await _flushMicrotasks();

    expect(model.leaderboard.length, 1);
    expect(model.leaderboard.first.username, "alice");
    expect(model.leaderboard.first.score, 2);
  });

  test("question message updates current question", () async {
    final client = FakeQuizWebSocketClient();
    final model = QuizViewModel(client: client);

    await model.joinQuiz(
      serverUrl: "ws://localhost:3000",
      quizId: "quiz-1",
      username: "alice",
    );

    client.emitMessage({
      "type": "question",
      "quizId": "quiz-1",
      "questionId": "q5",
      "prompt": "What is 2 + 3?",
      "options": [
        {"id": "q5_a", "text": "4"},
        {"id": "q5_b", "text": "5"},
        {"id": "q5_c", "text": "6"},
        {"id": "q5_d", "text": "7"},
      ],
    });
    await _flushMicrotasks();

    expect(model.currentQuestion?.questionId, "q5");
    expect(model.currentQuestion?.options.length, 4);
  });

  test("error message sets status and message", () async {
    final client = FakeQuizWebSocketClient();
    final model = QuizViewModel(client: client);

    await model.joinQuiz(
      serverUrl: "ws://localhost:3000",
      quizId: "quiz-1",
      username: "alice",
    );

    client.emitMessage({
      "type": "error",
      "message": "Server error",
    });
    await _flushMicrotasks();

    expect(model.status, ConnectionStatus.error);
    expect(model.errorMessage, "Server error");
  });
}
