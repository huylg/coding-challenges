/// A participant score entry used in leaderboard updates.
class LeaderboardEntry {
  const LeaderboardEntry({
    required this.username,
    required this.score,
  });

  final String username;
  final int score;

  factory LeaderboardEntry.fromJson(Map<String, dynamic> json) {
    return LeaderboardEntry(
      username: json["username"] as String? ?? "",
      score: json["score"] as int? ?? 0,
    );
  }
}

/// A leaderboard update message sent from the server.
class LeaderboardUpdate {
  const LeaderboardUpdate({
    required this.quizId,
    required this.leaderboard,
  });

  final String quizId;
  final List<LeaderboardEntry> leaderboard;

  factory LeaderboardUpdate.fromJson(Map<String, dynamic> json) {
    final entries = (json["leaderboard"] as List<dynamic>? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(LeaderboardEntry.fromJson)
        .toList();
    return LeaderboardUpdate(
      quizId: json["quizId"] as String? ?? "",
      leaderboard: entries,
    );
  }
}

/// A selectable option for a question prompt.
class QuestionOption {
  const QuestionOption({
    required this.id,
    required this.text,
  });

  final String id;
  final String text;

  factory QuestionOption.fromJson(Map<String, dynamic> json) {
    return QuestionOption(
      id: json["id"] as String? ?? "",
      text: json["text"] as String? ?? "",
    );
  }
}

/// A question payload sent from the server.
class QuestionMessage {
  const QuestionMessage({
    required this.quizId,
    required this.questionId,
    required this.prompt,
    required this.options,
  });

  final String quizId;
  final String questionId;
  final String prompt;
  final List<QuestionOption> options;

  factory QuestionMessage.fromJson(Map<String, dynamic> json) {
    final optionList = (json["options"] as List<dynamic>? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(QuestionOption.fromJson)
        .toList();
    return QuestionMessage(
      quizId: json["quizId"] as String? ?? "",
      questionId: json["questionId"] as String? ?? "",
      prompt: json["prompt"] as String? ?? "",
      options: optionList,
    );
  }
}
