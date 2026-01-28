# Auto unselect option behavior
_Exported on 1/28/2026 at 12:53:50 GMT+7 from Cursor (2.4.21)_

---

**User**

@client/ @/Users/huy.ly/.cursor/projects/Users-huy-ly-personal-coding-challenges/agent-transcripts/048f9c53-8f53-4f1d-8093-ab1b2091cf14.txt auto unslect option when i don't pick

---

**Cursor**

Added toggleable radio options so a selected choice can auto-unselect when you decide not to pick (tap the same option again), clearing `selectedOptionId` and disabling submit.  
```210:238:client/lib/ui/quiz_screen.dart
        ...question.options.map(
          (option) => RadioListTile<String>(
            value: option.id,
            groupValue: selectedOptionId,
            title: Text(option.text),
            onChanged: onOptionSelected,
            toggleable: true,
          ),
        ),
```

If you meant a timed auto-clear (e.g., unselect after X seconds of inactivity), tell me the timeout and I’ll add it.

