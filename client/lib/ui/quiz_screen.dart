import "package:flutter/material.dart";

import "../data/quiz_view_model.dart";
import "../models/quiz_models.dart";
import "leaderboard_widget.dart";

// AI-assisted section: Cursor AI helped outline a Flutter screen layout and
// ChangeNotifier-based state handling. Verified by manual review of widget
// rebuild paths and null-safety in controllers.

class QuizScreen extends StatefulWidget {
  const QuizScreen({super.key});

  @override
  State<QuizScreen> createState() => _QuizScreenState();
}

class _QuizScreenState extends State<QuizScreen> {
  late final QuizViewModel _viewModel;
  late final TextEditingController _serverController;
  late final TextEditingController _quizIdController;
  late final TextEditingController _usernameController;

  @override
  void initState() {
    super.initState();
    _viewModel = QuizViewModel();
    _serverController = TextEditingController(text: "ws://localhost:3000");
    _quizIdController = TextEditingController();
    _usernameController = TextEditingController();
  }

  @override
  void dispose() {
    _viewModel.dispose();
    _serverController.dispose();
    _quizIdController.dispose();
    _usernameController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Realtime Quiz")),
      body: ListenableBuilder(
        listenable: _viewModel,
        builder: (context, _) {
          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _StatusBanner(
                  status: _viewModel.status,
                  errorMessage: _viewModel.errorMessage,
                ),
                const SizedBox(height: 16),
                _JoinSection(
                  serverController: _serverController,
                  quizIdController: _quizIdController,
                  usernameController: _usernameController,
                  onJoin: _handleJoin,
                ),
                const SizedBox(height: 24),
                if (_viewModel.isInSession) ...[
                  LeaderboardWidget(leaderboard: _viewModel.leaderboard),
                  const SizedBox(height: 24),
                  if (_viewModel.currentQuestion != null)
                    _QuestionSection(
                      question: _viewModel.currentQuestion!,
                      selectedOptionId: _viewModel.selectedOptionId,
                      onOptionSelected: _viewModel.selectOption,
                      onSubmit: _viewModel.submitSelectedAnswer,
                    )
                  else
                    Text(
                      "Waiting for the next question...",
                      style: Theme.of(context).textTheme.bodyLarge,
                    ),
                ],
              ],
            ),
          );
        },
      ),
    );
  }

  Future<void> _handleJoin() async {
    await _viewModel.joinQuiz(
      serverUrl: _serverController.text,
      quizId: _quizIdController.text,
      username: _usernameController.text,
    );
  }
}

class _StatusBanner extends StatelessWidget {
  const _StatusBanner({
    required this.status,
    required this.errorMessage,
  });

  final ConnectionStatus status;
  final String? errorMessage;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final text = switch (status) {
      ConnectionStatus.connected => "Connected",
      ConnectionStatus.connecting => "Connecting…",
      ConnectionStatus.error => errorMessage ?? "Connection error",
      ConnectionStatus.disconnected => "Disconnected",
    };
    final color = switch (status) {
      ConnectionStatus.connected => theme.colorScheme.primary,
      ConnectionStatus.connecting => theme.colorScheme.tertiary,
      ConnectionStatus.error => theme.colorScheme.error,
      ConnectionStatus.disconnected => theme.colorScheme.outline,
    };
    return Semantics(
      label: "Connection status: $text",
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: color.withOpacity(0.12),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(
          text,
          style: theme.textTheme.titleSmall?.copyWith(color: color),
        ),
      ),
    );
  }
}

class _JoinSection extends StatelessWidget {
  const _JoinSection({
    required this.serverController,
    required this.quizIdController,
    required this.usernameController,
    required this.onJoin,
  });

  final TextEditingController serverController;
  final TextEditingController quizIdController;
  final TextEditingController usernameController;
  final VoidCallback onJoin;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          "Join a quiz",
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 12),
        TextField(
          controller: serverController,
          decoration: const InputDecoration(
            labelText: "Server URL",
            hintText: "ws://localhost:3000",
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: quizIdController,
          decoration: const InputDecoration(
            labelText: "Quiz ID",
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: usernameController,
          decoration: const InputDecoration(
            labelText: "Username",
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 12),
        ElevatedButton(
          onPressed: onJoin,
          child: const Text("Join"),
        ),
      ],
    );
  }
}

class _QuestionSection extends StatelessWidget {
  const _QuestionSection({
    required this.question,
    required this.selectedOptionId,
    required this.onOptionSelected,
    required this.onSubmit,
  });

  final QuestionMessage question;
  final String? selectedOptionId;
  final ValueChanged<String?> onOptionSelected;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    final isSubmitEnabled = selectedOptionId != null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          "Question",
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 8),
        Text(
          question.prompt,
          style: Theme.of(context).textTheme.bodyLarge,
        ),
        const SizedBox(height: 12),
        ...question.options.map(
          (option) => RadioListTile<String>(
            value: option.id,
            groupValue: selectedOptionId,
            title: Text(option.text),
            onChanged: onOptionSelected,
          ),
        ),
        const SizedBox(height: 12),
        ElevatedButton(
          onPressed: isSubmitEnabled ? onSubmit : null,
          child: const Text("Submit answer"),
        ),
      ],
    );
  }
}
