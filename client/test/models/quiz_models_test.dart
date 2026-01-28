import "package:flutter_test/flutter_test.dart";

import "package:realtime_quiz_client/models/quiz_models.dart";

void main() {
  test("LeaderboardEntry.fromJson parses defaults", () {
    final entry = LeaderboardEntry.fromJson({});
    expect(entry.username, "");
    expect(entry.score, 0);
  });

  test("LeaderboardEntry.fromJson parses values", () {
    final entry = LeaderboardEntry.fromJson({
      "username": "alice",
      "score": 3,
    });
    expect(entry.username, "alice");
    expect(entry.score, 3);
  });

  test("LeaderboardUpdate.fromJson parses entries", () {
    final update = LeaderboardUpdate.fromJson({
      "quizId": "quiz-1",
      "leaderboard": [
        {"username": "alice", "score": 2},
        {"username": "bob", "score": 1},
        "skip",
      ],
    });
    expect(update.quizId, "quiz-1");
    expect(update.leaderboard.length, 2);
  });
}
