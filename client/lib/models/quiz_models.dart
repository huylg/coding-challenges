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
