import "package:flutter/material.dart";

import "../models/quiz_models.dart";

/// Displays a list of participants ordered by score.
class LeaderboardWidget extends StatelessWidget {
  const LeaderboardWidget({
    super.key,
    required this.leaderboard,
  });

  final List<LeaderboardEntry> leaderboard;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: "Leaderboard",
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            "Leaderboard",
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 12),
          if (leaderboard.isEmpty)
            const Text("No participants yet.")
          else
            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: leaderboard.length,
              itemBuilder: (context, index) {
                final entry = leaderboard[index];
                return ListTile(
                  leading: CircleAvatar(child: Text("${index + 1}")),
                  title: Text(entry.username),
                  trailing: Text(entry.score.toString()),
                );
              },
            ),
        ],
      ),
    );
  }
}
