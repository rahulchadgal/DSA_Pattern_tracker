/**
 * frontend-app/constants.company.ts
 *
 * Manually curated company-wise LeetCode question list.
 *
 * Structure:
 *   company  — company name (must match exactly across entries)
 *   questions:
 *     id         — LeetCode problem number (string)
 *     title      — exact LeetCode problem title
 *     difficulty — "Easy" | "Medium" | "Hard"
 *     bucket     — time window the question was seen:
 *                  "all"  → always asked  (bucket_mask = 1)
 *                  "30d"  → last 30 days  (bucket_mask = 2)
 *                  "3m"   → last 3 months (bucket_mask = 4)
 *                  "6m"   → last 6 months (bucket_mask = 8)
 */

export interface CompanyQuestion {
  id: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  bucket: 'all' | '30d' | '3m' | '6m';
}

export interface CompanyEntry {
  company: string;
  questions: CompanyQuestion[];
}

export const COMPANY_DATA: CompanyEntry[] = [
  // ── Google ────────────────────────────────────────────────────────────────
  {
    company: 'Google',
    questions: [
      { id: '1', title: 'Two Sum', difficulty: 'Easy', bucket: 'all' },
      { id: '2', title: 'Add Two Numbers', difficulty: 'Medium', bucket: 'all' },
      { id: '3', title: 'Longest Substring Without Repeating Characters', difficulty: 'Medium', bucket: 'all' },
      { id: '4', title: 'Median of Two Sorted Arrays', difficulty: 'Hard', bucket: '6m' },
      { id: '5', title: 'Longest Palindromic Substring', difficulty: 'Medium', bucket: 'all' },
      { id: '20', title: 'Valid Parentheses', difficulty: 'Easy', bucket: 'all' },
      { id: '23', title: 'Merge k Sorted Lists', difficulty: 'Hard', bucket: '3m' },
      { id: '42', title: 'Trapping Rain Water', difficulty: 'Hard', bucket: 'all' },
      { id: '56', title: 'Merge Intervals', difficulty: 'Medium', bucket: 'all' },
      { id: '68', title: 'Text Justification', difficulty: 'Hard', bucket: '30d' },
      { id: '76', title: 'Minimum Window Substring', difficulty: 'Hard', bucket: 'all' },
      { id: '84', title: 'Largest Rectangle in Histogram', difficulty: 'Hard', bucket: '6m' },
      { id: '127', title: 'Word Ladder', difficulty: 'Hard', bucket: '3m' },
      { id: '128', title: 'Longest Consecutive Sequence', difficulty: 'Medium', bucket: 'all' },
      { id: '146', title: 'LRU Cache', difficulty: 'Medium', bucket: 'all' },
      { id: '200', title: 'Number of Islands', difficulty: 'Medium', bucket: 'all' },
      { id: '207', title: 'Course Schedule', difficulty: 'Medium', bucket: 'all' },
      { id: '212', title: 'Word Search II', difficulty: 'Hard', bucket: '6m' },
      { id: '218', title: 'The Skyline Problem', difficulty: 'Hard', bucket: '6m' },
      { id: '239', title: 'Sliding Window Maximum', difficulty: 'Hard', bucket: '3m' },
      { id: '269', title: 'Alien Dictionary', difficulty: 'Hard', bucket: '3m' },
      { id: '297', title: 'Serialize and Deserialize Binary Tree', difficulty: 'Hard', bucket: 'all' },
      { id: '300', title: 'Longest Increasing Subsequence', difficulty: 'Medium', bucket: '3m' },
      { id: '315', title: 'Count of Smaller Numbers After Self', difficulty: 'Hard', bucket: '6m' },
      { id: '340', title: 'Longest Substring with At Most K Distinct Characters', difficulty: 'Medium', bucket: '3m' },
      { id: '380', title: 'Insert Delete GetRandom O(1)', difficulty: 'Medium', bucket: 'all' },
      { id: '410', title: 'Split Array Largest Sum', difficulty: 'Hard', bucket: '6m' },
      { id: '460', title: 'LFU Cache', difficulty: 'Hard', bucket: '6m' },
      { id: '588', title: 'Design In-Memory File System', difficulty: 'Hard', bucket: '6m' },
      { id: '691', title: 'Stickers to Spell Word', difficulty: 'Hard', bucket: '6m' },
      { id: '716', title: 'Max Stack', difficulty: 'Hard', bucket: '6m' },
      { id: '843', title: 'Guess the Word', difficulty: 'Hard', bucket: '30d' },
      { id: '936', title: 'Stamping The Sequence', difficulty: 'Hard', bucket: '6m' },
    ],
  },

  // ── Meta (Facebook) ───────────────────────────────────────────────────────
  {
    company: 'Meta',
    questions: [
      { id: '1', title: 'Two Sum', difficulty: 'Easy', bucket: 'all' },
      { id: '15', title: '3Sum', difficulty: 'Medium', bucket: 'all' },
      { id: '20', title: 'Valid Parentheses', difficulty: 'Easy', bucket: 'all' },
      { id: '21', title: 'Merge Two Sorted Lists', difficulty: 'Easy', bucket: 'all' },
      { id: '23', title: 'Merge k Sorted Lists', difficulty: 'Hard', bucket: '3m' },
      { id: '50', title: 'Pow(x, n)', difficulty: 'Medium', bucket: '6m' },
      { id: '56', title: 'Merge Intervals', difficulty: 'Medium', bucket: 'all' },
      { id: '57', title: 'Insert Interval', difficulty: 'Medium', bucket: 'all' },
      { id: '76', title: 'Minimum Window Substring', difficulty: 'Hard', bucket: '3m' },
      { id: '88', title: 'Merge Sorted Array', difficulty: 'Easy', bucket: 'all' },
      { id: '121', title: 'Best Time to Buy and Sell Stock', difficulty: 'Easy', bucket: 'all' },
      { id: '124', title: 'Binary Tree Maximum Path Sum', difficulty: 'Hard', bucket: 'all' },
      { id: '125', title: 'Valid Palindrome', difficulty: 'Easy', bucket: 'all' },
      { id: '128', title: 'Longest Consecutive Sequence', difficulty: 'Medium', bucket: 'all' },
      { id: '138', title: 'Copy List with Random Pointer', difficulty: 'Medium', bucket: 'all' },
      { id: '146', title: 'LRU Cache', difficulty: 'Medium', bucket: 'all' },
      { id: '157', title: 'Read N Characters Given Read4', difficulty: 'Easy', bucket: '6m' },
      { id: '158', title: 'Read N Characters Given Read4 II', difficulty: 'Hard', bucket: '6m' },
      { id: '200', title: 'Number of Islands', difficulty: 'Medium', bucket: 'all' },
      { id: '206', title: 'Reverse Linked List', difficulty: 'Easy', bucket: 'all' },
      { id: '215', title: 'Kth Largest Element in an Array', difficulty: 'Medium', bucket: 'all' },
      { id: '227', title: 'Basic Calculator II', difficulty: 'Medium', bucket: '3m' },
      { id: '236', title: 'Lowest Common Ancestor of a Binary Tree', difficulty: 'Medium', bucket: 'all' },
      { id: '238', title: 'Product of Array Except Self', difficulty: 'Medium', bucket: 'all' },
      { id: '239', title: 'Sliding Window Maximum', difficulty: 'Hard', bucket: '6m' },
      { id: '249', title: 'Group Shifted Strings', difficulty: 'Medium', bucket: '3m' },
      { id: '253', title: 'Meeting Rooms II', difficulty: 'Medium', bucket: 'all' },
      { id: '269', title: 'Alien Dictionary', difficulty: 'Hard', bucket: '6m' },
      { id: '273', title: 'Integer to English Words', difficulty: 'Hard', bucket: '3m' },
      { id: '297', title: 'Serialize and Deserialize Binary Tree', difficulty: 'Hard', bucket: '3m' },
      { id: '314', title: 'Binary Tree Vertical Order Traversal', difficulty: 'Medium', bucket: 'all' },
      { id: '323', title: 'Number of Connected Components in an Undirected Graph', difficulty: 'Medium', bucket: '6m' },
      { id: '346', title: 'Moving Average from Data Stream', difficulty: 'Easy', bucket: 'all' },
      { id: '362', title: 'Design Hit Counter', difficulty: 'Medium', bucket: 'all' },
      { id: '408', title: 'Valid Word Abbreviation', difficulty: 'Easy', bucket: 'all' },
      { id: '415', title: 'Add Strings', difficulty: 'Easy', bucket: 'all' },
      { id: '426', title: 'Convert Binary Search Tree to Sorted Doubly Linked List', difficulty: 'Medium', bucket: 'all' },
      { id: '528', title: 'Random Pick with Weight', difficulty: 'Medium', bucket: '3m' },
      { id: '543', title: 'Diameter of Binary Tree', difficulty: 'Easy', bucket: 'all' },
      { id: '560', title: 'Subarray Sum Equals K', difficulty: 'Medium', bucket: '3m' },
      { id: '721', title: 'Accounts Merge', difficulty: 'Medium', bucket: '3m' },
      { id: '938', title: 'Range Sum of BST', difficulty: 'Easy', bucket: 'all' },
      { id: '973', title: 'K Closest Points to Origin', difficulty: 'Medium', bucket: 'all' },
      { id: '1091', title: 'Shortest Path in Binary Matrix', difficulty: 'Medium', bucket: '6m' },
      { id: '1249', title: 'Minimum Remove to Make Valid Parentheses', difficulty: 'Medium', bucket: 'all' },
      { id: '1650', title: 'Lowest Common Ancestor of a Binary Tree III', difficulty: 'Medium', bucket: 'all' },
      { id: '1762', title: 'Buildings With an Ocean View', difficulty: 'Medium', bucket: 'all' },
    ],
  },

  // ── Amazon ─────────────────────────────────────────��──────────────────────
  {
    company: 'Amazon',
    questions: [
      { id: '1', title: 'Two Sum', difficulty: 'Easy', bucket: 'all' },
      { id: '2', title: 'Add Two Numbers', difficulty: 'Medium', bucket: '3m' },
      { id: '15', title: '3Sum', difficulty: 'Medium', bucket: '3m' },
      { id: '20', title: 'Valid Parentheses', difficulty: 'Easy', bucket: 'all' },
      { id: '21', title: 'Merge Two Sorted Lists', difficulty: 'Easy', bucket: 'all' },
      { id: '23', title: 'Merge k Sorted Lists', difficulty: 'Hard', bucket: 'all' },
      { id: '25', title: 'Reverse Nodes in k-Group', difficulty: 'Hard', bucket: '6m' },
      { id: '42', title: 'Trapping Rain Water', difficulty: 'Hard', bucket: '3m' },
      { id: '49', title: 'Group Anagrams', difficulty: 'Medium', bucket: 'all' },
      { id: '56', title: 'Merge Intervals', difficulty: 'Medium', bucket: 'all' },
      { id: '76', title: 'Minimum Window Substring', difficulty: 'Hard', bucket: '3m' },
      { id: '102', title: 'Binary Tree Level Order Traversal', difficulty: 'Medium', bucket: 'all' },
      { id: '121', title: 'Best Time to Buy and Sell Stock', difficulty: 'Easy', bucket: 'all' },
      { id: '127', title: 'Word Ladder', difficulty: 'Hard', bucket: '3m' },
      { id: '128', title: 'Longest Consecutive Sequence', difficulty: 'Medium', bucket: 'all' },
      { id: '138', title: 'Copy List with Random Pointer', difficulty: 'Medium', bucket: '3m' },
      { id: '139', title: 'Word Break', difficulty: 'Medium', bucket: 'all' },
      { id: '146', title: 'LRU Cache', difficulty: 'Medium', bucket: 'all' },
      { id: '200', title: 'Number of Islands', difficulty: 'Medium', bucket: 'all' },
      { id: '206', title: 'Reverse Linked List', difficulty: 'Easy', bucket: 'all' },
      { id: '207', title: 'Course Schedule', difficulty: 'Medium', bucket: '3m' },
      { id: '210', title: 'Course Schedule II', difficulty: 'Medium', bucket: '3m' },
      { id: '212', title: 'Word Search II', difficulty: 'Hard', bucket: '6m' },
      { id: '215', title: 'Kth Largest Element in an Array', difficulty: 'Medium', bucket: 'all' },
      { id: '236', title: 'Lowest Common Ancestor of a Binary Tree', difficulty: 'Medium', bucket: 'all' },
      { id: '238', title: 'Product of Array Except Self', difficulty: 'Medium', bucket: 'all' },
      { id: '253', title: 'Meeting Rooms II', difficulty: 'Medium', bucket: 'all' },
      { id: '295', title: 'Find Median from Data Stream', difficulty: 'Hard', bucket: '3m' },
      { id: '297', title: 'Serialize and Deserialize Binary Tree', difficulty: 'Hard', bucket: '3m' },
      { id: '300', title: 'Longest Increasing Subsequence', difficulty: 'Medium', bucket: '6m' },
      { id: '322', title: 'Coin Change', difficulty: 'Medium', bucket: 'all' },
      { id: '380', title: 'Insert Delete GetRandom O(1)', difficulty: 'Medium', bucket: '3m' },
      { id: '460', title: 'LFU Cache', difficulty: 'Hard', bucket: '6m' },
      { id: '543', title: 'Diameter of Binary Tree', difficulty: 'Easy', bucket: '3m' },
      { id: '560', title: 'Subarray Sum Equals K', difficulty: 'Medium', bucket: '3m' },
      { id: '692', title: 'Top K Frequent Words', difficulty: 'Medium', bucket: '3m' },
      { id: '721', title: 'Accounts Merge', difficulty: 'Medium', bucket: '6m' },
      { id: '743', title: 'Network Delay Time', difficulty: 'Medium', bucket: '3m' },
      { id: '937', title: 'Reorder Data in Log Files', difficulty: 'Medium', bucket: 'all' },
      { id: '973', title: 'K Closest Points to Origin', difficulty: 'Medium', bucket: 'all' },
      { id: '1167', title: 'Minimum Cost to Connect Sticks', difficulty: 'Medium', bucket: '3m' },
      { id: '1249', title: 'Minimum Remove to Make Valid Parentheses', difficulty: 'Medium', bucket: '3m' },
    ],
  },

  // ── Microsoft ─────────────────────────────────────────────────────────────
  {
    company: 'Microsoft',
    questions: [
      { id: '1', title: 'Two Sum', difficulty: 'Easy', bucket: 'all' },
      { id: '2', title: 'Add Two Numbers', difficulty: 'Medium', bucket: 'all' },
      { id: '3', title: 'Longest Substring Without Repeating Characters', difficulty: 'Medium', bucket: 'all' },
      { id: '7', title: 'Reverse Integer', difficulty: 'Medium', bucket: 'all' },
      { id: '20', title: 'Valid Parentheses', difficulty: 'Easy', bucket: 'all' },
      { id: '21', title: 'Merge Two Sorted Lists', difficulty: 'Easy', bucket: 'all' },
      { id: '42', title: 'Trapping Rain Water', difficulty: 'Hard', bucket: '3m' },
      { id: '48', title: 'Rotate Image', difficulty: 'Medium', bucket: 'all' },
      { id: '53', title: 'Maximum Subarray', difficulty: 'Medium', bucket: 'all' },
      { id: '56', title: 'Merge Intervals', difficulty: 'Medium', bucket: 'all' },
      { id: '62', title: 'Unique Paths', difficulty: 'Medium', bucket: '3m' },
      { id: '70', title: 'Climbing Stairs', difficulty: 'Easy', bucket: 'all' },
      { id: '98', title: 'Validate Binary Search Tree', difficulty: 'Medium', bucket: 'all' },
      { id: '102', title: 'Binary Tree Level Order Traversal', difficulty: 'Medium', bucket: 'all' },
      { id: '104', title: 'Maximum Depth of Binary Tree', difficulty: 'Easy', bucket: 'all' },
      { id: '121', title: 'Best Time to Buy and Sell Stock', difficulty: 'Easy', bucket: 'all' },
      { id: '141', title: 'Linked List Cycle', difficulty: 'Easy', bucket: 'all' },
      { id: '146', title: 'LRU Cache', difficulty: 'Medium', bucket: 'all' },
      { id: '200', title: 'Number of Islands', difficulty: 'Medium', bucket: 'all' },
      { id: '206', title: 'Reverse Linked List', difficulty: 'Easy', bucket: 'all' },
      { id: '207', title: 'Course Schedule', difficulty: 'Medium', bucket: '3m' },
      { id: '208', title: 'Implement Trie (Prefix Tree)', difficulty: 'Medium', bucket: '3m' },
      { id: '215', title: 'Kth Largest Element in an Array', difficulty: 'Medium', bucket: '3m' },
      { id: '236', title: 'Lowest Common Ancestor of a Binary Tree', difficulty: 'Medium', bucket: '3m' },
      { id: '238', title: 'Product of Array Except Self', difficulty: 'Medium', bucket: '3m' },
      { id: '297', title: 'Serialize and Deserialize Binary Tree', difficulty: 'Hard', bucket: '6m' },
      { id: '300', title: 'Longest Increasing Subsequence', difficulty: 'Medium', bucket: '3m' },
      { id: '322', title: 'Coin Change', difficulty: 'Medium', bucket: '3m' },
      { id: '543', title: 'Diameter of Binary Tree', difficulty: 'Easy', bucket: '3m' },
      { id: '560', title: 'Subarray Sum Equals K', difficulty: 'Medium', bucket: '3m' },
      { id: '695', title: 'Max Area of Island', difficulty: 'Medium', bucket: '3m' },
    ],
  },

  // ── Apple ─────────────────────────────────────────────────────────────────
  {
    company: 'Apple',
    questions: [
      { id: '1', title: 'Two Sum', difficulty: 'Easy', bucket: 'all' },
      { id: '3', title: 'Longest Substring Without Repeating Characters', difficulty: 'Medium', bucket: 'all' },
      { id: '20', title: 'Valid Parentheses', difficulty: 'Easy', bucket: 'all' },
      { id: '21', title: 'Merge Two Sorted Lists', difficulty: 'Easy', bucket: 'all' },
      { id: '42', title: 'Trapping Rain Water', difficulty: 'Hard', bucket: '3m' },
      { id: '56', title: 'Merge Intervals', difficulty: 'Medium', bucket: 'all' },
      { id: '76', title: 'Minimum Window Substring', difficulty: 'Hard', bucket: '6m' },
      { id: '121', title: 'Best Time to Buy and Sell Stock', difficulty: 'Easy', bucket: 'all' },
      { id: '128', title: 'Longest Consecutive Sequence', difficulty: 'Medium', bucket: '3m' },
      { id: '146', title: 'LRU Cache', difficulty: 'Medium', bucket: 'all' },
      { id: '200', title: 'Number of Islands', difficulty: 'Medium', bucket: 'all' },
      { id: '206', title: 'Reverse Linked List', difficulty: 'Easy', bucket: 'all' },
      { id: '215', title: 'Kth Largest Element in an Array', difficulty: 'Medium', bucket: '3m' },
      { id: '236', title: 'Lowest Common Ancestor of a Binary Tree', difficulty: 'Medium', bucket: '3m' },
      { id: '238', title: 'Product of Array Except Self', difficulty: 'Medium', bucket: 'all' },
      { id: '295', title: 'Find Median from Data Stream', difficulty: 'Hard', bucket: '6m' },
      { id: '300', title: 'Longest Increasing Subsequence', difficulty: 'Medium', bucket: '6m' },
      { id: '322', title: 'Coin Change', difficulty: 'Medium', bucket: '3m' },
      { id: '347', title: 'Top K Frequent Elements', difficulty: 'Medium', bucket: '3m' },
      { id: '560', title: 'Subarray Sum Equals K', difficulty: 'Medium', bucket: '3m' },
    ],
  },

  // ── Netflix ───────────────────────────────────────────────────────────────
  {
    company: 'Netflix',
    questions: [
      { id: '1', title: 'Two Sum', difficulty: 'Easy', bucket: 'all' },
      { id: '4', title: 'Median of Two Sorted Arrays', difficulty: 'Hard', bucket: '6m' },
      { id: '23', title: 'Merge k Sorted Lists', difficulty: 'Hard', bucket: '3m' },
      { id: '42', title: 'Trapping Rain Water', difficulty: 'Hard', bucket: '6m' },
      { id: '76', title: 'Minimum Window Substring', difficulty: 'Hard', bucket: '6m' },
      { id: '146', title: 'LRU Cache', difficulty: 'Medium', bucket: 'all' },
      { id: '200', title: 'Number of Islands', difficulty: 'Medium', bucket: '3m' },
      { id: '215', title: 'Kth Largest Element in an Array', difficulty: 'Medium', bucket: '3m' },
      { id: '239', title: 'Sliding Window Maximum', difficulty: 'Hard', bucket: '6m' },
      { id: '295', title: 'Find Median from Data Stream', difficulty: 'Hard', bucket: '3m' },
      { id: '297', title: 'Serialize and Deserialize Binary Tree', difficulty: 'Hard', bucket: '6m' },
      { id: '460', title: 'LFU Cache', difficulty: 'Hard', bucket: '6m' },
    ],
  },

  // ── Adobe ─────────────────────────────────────────────────────────────────
  {
    company: 'Adobe',
    questions: [
      { id: '1', title: 'Two Sum', difficulty: 'Easy', bucket: 'all' },
      { id: '15', title: '3Sum', difficulty: 'Medium', bucket: '3m' },
      { id: '20', title: 'Valid Parentheses', difficulty: 'Easy', bucket: 'all' },
      { id: '42', title: 'Trapping Rain Water', difficulty: 'Hard', bucket: '3m' },
      { id: '48', title: 'Rotate Image', difficulty: 'Medium', bucket: '3m' },
      { id: '53', title: 'Maximum Subarray', difficulty: 'Medium', bucket: 'all' },
      { id: '56', title: 'Merge Intervals', difficulty: 'Medium', bucket: 'all' },
      { id: '84', title: 'Largest Rectangle in Histogram', difficulty: 'Hard', bucket: '6m' },
      { id: '121', title: 'Best Time to Buy and Sell Stock', difficulty: 'Easy', bucket: 'all' },
      { id: '146', title: 'LRU Cache', difficulty: 'Medium', bucket: '3m' },
      { id: '200', title: 'Number of Islands', difficulty: 'Medium', bucket: '3m' },
      { id: '206', title: 'Reverse Linked List', difficulty: 'Easy', bucket: 'all' },
      { id: '238', title: 'Product of Array Except Self', difficulty: 'Medium', bucket: '3m' },
      { id: '295', title: 'Find Median from Data Stream', difficulty: 'Hard', bucket: '6m' },
      { id: '300', title: 'Longest Increasing Subsequence', difficulty: 'Medium', bucket: '6m' },
      { id: '322', title: 'Coin Change', difficulty: 'Medium', bucket: '3m' },
    ],
  },

  // ── Uber ──────────────────────────────────────────────────────────────────
  {
    company: 'Uber',
    questions: [
      { id: '1', title: 'Two Sum', difficulty: 'Easy', bucket: 'all' },
      { id: '15', title: '3Sum', difficulty: 'Medium', bucket: '3m' },
      { id: '20', title: 'Valid Parentheses', difficulty: 'Easy', bucket: 'all' },
      { id: '42', title: 'Trapping Rain Water', difficulty: 'Hard', bucket: '6m' },
      { id: '49', title: 'Group Anagrams', difficulty: 'Medium', bucket: '3m' },
      { id: '56', title: 'Merge Intervals', difficulty: 'Medium', bucket: 'all' },
      { id: '76', title: 'Minimum Window Substring', difficulty: 'Hard', bucket: '6m' },
      { id: '146', title: 'LRU Cache', difficulty: 'Medium', bucket: 'all' },
      { id: '200', title: 'Number of Islands', difficulty: 'Medium', bucket: '3m' },
      { id: '206', title: 'Reverse Linked List', difficulty: 'Easy', bucket: 'all' },
      { id: '215', title: 'Kth Largest Element in an Array', difficulty: 'Medium', bucket: '3m' },
      { id: '238', title: 'Product of Array Except Self', difficulty: 'Medium', bucket: '3m' },
      { id: '253', title: 'Meeting Rooms II', difficulty: 'Medium', bucket: '3m' },
      { id: '295', title: 'Find Median from Data Stream', difficulty: 'Hard', bucket: '6m' },
      { id: '347', title: 'Top K Frequent Elements', difficulty: 'Medium', bucket: '3m' },
      { id: '380', title: 'Insert Delete GetRandom O(1)', difficulty: 'Medium', bucket: '6m' },
      { id: '528', title: 'Random Pick with Weight', difficulty: 'Medium', bucket: '3m' },
    ],
  },

  // ── LinkedIn ──────────────────────────────────────────────────────────────
  {
    company: 'LinkedIn',
    questions: [
      { id: '1', title: 'Two Sum', difficulty: 'Easy', bucket: 'all' },
      { id: '20', title: 'Valid Parentheses', difficulty: 'Easy', bucket: 'all' },
      { id: '23', title: 'Merge k Sorted Lists', difficulty: 'Hard', bucket: '6m' },
      { id: '56', title: 'Merge Intervals', difficulty: 'Medium', bucket: 'all' },
      { id: '128', title: 'Longest Consecutive Sequence', difficulty: 'Medium', bucket: '3m' },
      { id: '146', title: 'LRU Cache', difficulty: 'Medium', bucket: 'all' },
      { id: '200', title: 'Number of Islands', difficulty: 'Medium', bucket: '3m' },
      { id: '206', title: 'Reverse Linked List', difficulty: 'Easy', bucket: 'all' },
      { id: '215', title: 'Kth Largest Element in an Array', difficulty: 'Medium', bucket: '3m' },
      { id: '236', title: 'Lowest Common Ancestor of a Binary Tree', difficulty: 'Medium', bucket: '3m' },
      { id: '238', title: 'Product of Array Except Self', difficulty: 'Medium', bucket: '3m' },
      { id: '295', title: 'Find Median from Data Stream', difficulty: 'Hard', bucket: '6m' },
      { id: '300', title: 'Longest Increasing Subsequence', difficulty: 'Medium', bucket: '6m' },
      { id: '347', title: 'Top K Frequent Elements', difficulty: 'Medium', bucket: '3m' },
    ],
  },

  // ── Salesforce ────────────────────────────────────────────────────────────
  {
    company: 'Salesforce',
    questions: [
      { id: '1', title: 'Two Sum', difficulty: 'Easy', bucket: 'all' },
      { id: '20', title: 'Valid Parentheses', difficulty: 'Easy', bucket: 'all' },
      { id: '53', title: 'Maximum Subarray', difficulty: 'Medium', bucket: 'all' },
      { id: '56', title: 'Merge Intervals', difficulty: 'Medium', bucket: '3m' },
      { id: '70', title: 'Climbing Stairs', difficulty: 'Easy', bucket: 'all' },
      { id: '102', title: 'Binary Tree Level Order Traversal', difficulty: 'Medium', bucket: '3m' },
      { id: '121', title: 'Best Time to Buy and Sell Stock', difficulty: 'Easy', bucket: 'all' },
      { id: '146', title: 'LRU Cache', difficulty: 'Medium', bucket: '3m' },
      { id: '200', title: 'Number of Islands', difficulty: 'Medium', bucket: '3m' },
      { id: '206', title: 'Reverse Linked List', difficulty: 'Easy', bucket: 'all' },
      { id: '238', title: 'Product of Array Except Self', difficulty: 'Medium', bucket: '3m' },
      { id: '322', title: 'Coin Change', difficulty: 'Medium', bucket: '3m' },
    ],
  },
];
