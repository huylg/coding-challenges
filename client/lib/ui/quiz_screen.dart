import "package:flutter/material.dart";

import "../data/quiz_view_model.dart";
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
  late final TextEditingController _questionIdController;
  late final TextEditingController _answerController;
  bool _isCorrect = false;

  @override
  void initState() {
    super.initState();
    _viewModel = QuizViewModel();
    _serverController = TextEditingController(text: "ws://localhost:3000");
    _quizIdController = TextEditingController();
    _usernameController = TextEditingController();
    _questionIdController = TextEditingController(text: "q1");
    _answerController = TextEditingController();
  }

  @override
  void dispose() {
    _viewModel.dispose();
    _serverController.dispose();
    _quizIdController.dispose();
    _usernameController.dispose();
    _questionIdController.dispose();
    _answerController.dispose();
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
                  _AnswerSection(
                    questionIdController: _questionIdController,
                    answerController: _answerController,
                    isCorrect: _isCorrect,
                    onCorrectChanged: (value) {
                      setState(() => _isCorrect = value);
                    },
                    onSubmit: _handleSubmitAnswer,
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

  void _handleSubmitAnswer() {
    _viewModel.submitAnswer(
      questionId: _questionIdController.text,
      answer: _answerController.text,
      isCorrect: _isCorrect,
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

class _AnswerSection extends StatelessWidget {
  const _AnswerSection({
    required this.questionIdController,
    required this.answerController,
    required this.isCorrect,
    required this.onCorrectChanged,
    required this.onSubmit,
  });

  final TextEditingController questionIdController;
  final TextEditingController answerController;
  final bool isCorrect;
  final ValueChanged<bool> onCorrectChanged;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          "Submit answer",
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 12),
        TextField(
          controller: questionIdController,
          decoration: const InputDecoration(
            labelText: "Question ID",
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: answerController,
          decoration: const InputDecoration(
            labelText: "Answer",
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 12),
        SwitchListTile(
          value: isCorrect,
          onChanged: onCorrectChanged,
          title: const Text("Mark as correct"),
        ),
        const SizedBox(height: 12),
        ElevatedButton(
          onPressed: onSubmit,
          child: const Text("Send answer"),
        ),
      ],
    );
  }
}
