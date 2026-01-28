import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";

import "package:realtime_quiz_client/ui/quiz_screen.dart";

void main() {
  testWidgets(
    "QuizScreen shows join UI and disconnected status",
    (tester) async {
      await tester.pumpWidget(const MaterialApp(home: QuizScreen()));

      expect(find.text("Realtime Quiz"), findsOneWidget);
      expect(find.text("Disconnected"), findsOneWidget);
      expect(find.text("Join a quiz"), findsOneWidget);
      expect(find.byType(TextField), findsNWidgets(3));
      expect(find.text("Leaderboard"), findsNothing);
      expect(find.text("Submit answer"), findsNothing);
    },
  );
}
