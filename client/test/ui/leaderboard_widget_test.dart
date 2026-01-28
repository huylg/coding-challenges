import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";

import "package:realtime_quiz_client/models/quiz_models.dart";
import "package:realtime_quiz_client/ui/leaderboard_widget.dart";

void main() {
  testWidgets("LeaderboardWidget shows empty state", (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: LeaderboardWidget(leaderboard: []),
        ),
      ),
    );

    expect(find.text("Leaderboard"), findsOneWidget);
    expect(find.text("No participants yet."), findsOneWidget);
  });

  testWidgets("LeaderboardWidget renders entries", (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: LeaderboardWidget(
            leaderboard: [
              const LeaderboardEntry(username: "alice", score: 3),
              const LeaderboardEntry(username: "bob", score: 1),
            ],
          ),
        ),
      ),
    );

    expect(find.text("Leaderboard"), findsOneWidget);
    expect(find.text("alice"), findsOneWidget);
    expect(find.text("bob"), findsOneWidget);
    expect(find.text("3"), findsOneWidget);
    expect(find.text("2"), findsOneWidget);
    expect(find.text("1"), findsNWidgets(2));
  });
}
