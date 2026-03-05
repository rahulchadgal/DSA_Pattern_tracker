
import { Section, Question } from './types';

// Hardcoded difficulty map for instant lookup (covers current syllabus)
const DIFFICULTY_MAP: Record<string, 'Easy' | 'Medium' | 'Hard'> = {
  // Pattern 1 & 2
  "1": "Easy", "11": "Medium", "15": "Medium", "16": "Medium", "18": "Medium", "167": "Medium", "349": "Easy", "881": "Medium", "977": "Easy", "259": "Medium",
  "141": "Easy", "202": "Easy", "287": "Medium", "392": "Easy",
  // Pattern 3 & 4
  "19": "Medium", "876": "Easy", "2095": "Medium",
  "26": "Easy", "27": "Easy", "75": "Medium", "80": "Medium", "283": "Easy", "443": "Medium", "905": "Easy", "2337": "Medium", "2938": "Medium",
  // Pattern 5, 6, 7
  "844": "Easy", "1598": "Easy", "2390": "Medium",
  "5": "Medium", "647": "Medium",
  "151": "Medium", "344": "Easy", "345": "Easy", "541": "Easy",
  // Sliding Window
  "346": "Easy", "643": "Easy", "2985": "Easy", "3254": "Easy", "3318": "Easy",
  "3": "Medium", "76": "Hard", "209": "Medium", "219": "Easy", "424": "Medium", "713": "Medium", "904": "Medium", "1004": "Medium", "1438": "Medium", "1493": "Medium", "1658": "Medium", "1838": "Medium", "2461": "Medium", "2516": "Medium", "2762": "Medium", "2779": "Medium", "2981": "Medium", "3026": "Medium", "3346": "Medium", "3347": "Hard",
  "239": "Hard", "862": "Hard", "1696": "Medium", "438": "Medium", "567": "Medium",
  // Trees
  "102": "Medium", "103": "Medium", "199": "Medium", "515": "Medium", "1161": "Medium",
  "100": "Easy", "101": "Easy", "105": "Medium", "114": "Medium", "226": "Easy", "257": "Easy", "988": "Medium",
  "94": "Easy", "98": "Medium", "173": "Medium", "230": "Medium", "501": "Easy", "530": "Easy",
  "104": "Easy", "110": "Easy", "124": "Hard", "145": "Easy", "337": "Medium", "366": "Medium", "543": "Easy", "863": "Medium", "1110": "Medium", "2458": "Hard",
  "235": "Medium", "236": "Medium", "297": "Hard", "572": "Easy", "652": "Medium",
  // Graphs
  "130": "Medium", "200": "Medium", "417": "Medium", "547": "Medium", "695": "Medium", "733": "Easy", "841": "Medium", "1020": "Medium", "1254": "Medium", "1905": "Medium", "2101": "Medium",
  "542": "Medium", "994": "Medium", "1091": "Medium", "207": "Medium", "210": "Medium", "802": "Medium", "1059": "Medium",
  "269": "Hard", "310": "Medium", "444": "Medium", "1136": "Medium", "1857": "Hard", "2050": "Hard", "2115": "Medium", "2392": "Hard",
  "133": "Medium", "1334": "Medium", "138": "Medium", "1490": "Easy",
  "743": "Medium", "778": "Hard", "1514": "Medium", "1631": "Medium", "1976": "Medium", "2045": "Hard", "2203": "Hard", "2290": "Hard", "2577": "Hard", "2812": "Medium",
  "787": "Medium", "1129": "Medium", "261": "Medium", "305": "Hard", "323": "Medium", "684": "Medium", "721": "Medium", "737": "Medium", "947": "Medium", "952": "Hard", "959": "Medium", "1101": "Medium",
  "1192": "Hard", "2360": "Hard", "1135": "Medium", "1584": "Medium", "1168": "Hard", "1489": "Hard", "127": "Hard", "126": "Hard", "815": "Hard",
  // DP
  "70": "Easy", "91": "Medium", "198": "Medium", "213": "Medium", "509": "Easy", "740": "Medium", "746": "Easy",
  "53": "Medium", "918": "Medium", "2321": "Hard", "1749": "Medium", "152": "Medium",
  "322": "Medium", "377": "Medium", "518": "Medium", "416": "Medium", "494": "Medium", "139": "Medium", "140": "Hard",
  "1143": "Medium", "1092": "Hard", "1312": "Hard", "72": "Hard", "583": "Medium", "712": "Medium",
  "62": "Medium", "63": "Medium", "64": "Medium", "120": "Medium", "221": "Medium", "931": "Medium", "1277": "Medium",
  "312": "Hard", "546": "Hard", "95": "Medium", "96": "Medium", "241": "Medium", "300": "Medium", "354": "Hard", "1671": "Hard", "2407": "Hard",
  "121": "Easy", "122": "Medium", "123": "Hard", "188": "Hard", "309": "Medium",
  // Heaps
  "215": "Medium", "347": "Medium", "451": "Medium", "506": "Easy", "703": "Easy", "973": "Medium", "1046": "Easy", "2558": "Easy",
  "295": "Hard", "1825": "Hard", "23": "Hard", "373": "Medium", "378": "Medium", "632": "Hard",
  "253": "Medium", "767": "Medium", "857": "Hard", "1642": "Medium", "1792": "Medium", "1834": "Medium", "1942": "Medium", "2402": "Hard",
  // Backtracking
  "17": "Medium", "77": "Medium", "78": "Medium", "90": "Medium", "31": "Medium", "46": "Medium", "60": "Hard", "39": "Medium", "40": "Medium", "22": "Medium", "301": "Hard", "79": "Medium", "212": "Hard", "2018": "Medium", "37": "Hard", "51": "Hard", "131": "Medium", "132": "Hard", "1457": "Medium",
  // Greedy
  "56": "Medium", "57": "Medium", "759": "Hard", "986": "Medium", "2406": "Medium", "45": "Medium", "55": "Medium", "134": "Medium", "2202": "Medium", "621": "Medium", "1054": "Medium", "455": "Easy", "135": "Hard", "406": "Medium", "1029": "Medium",
  // Binary Search
  "35": "Easy", "69": "Easy", "74": "Medium", "278": "Easy", "374": "Easy", "540": "Medium", "704": "Easy", "1539": "Easy", "33": "Medium", "81": "Medium", "153": "Medium", "162": "Medium", "852": "Medium", "1095": "Hard", "410": "Hard", "774": "Hard", "875": "Medium", "1011": "Medium", "1482": "Medium", "1760": "Medium", "2064": "Medium", "2226": "Medium", "34": "Medium", "658": "Medium", "4": "Hard", "719": "Hard",
  // Stack
  "20": "Easy", "32": "Hard", "921": "Medium", "1249": "Medium", "1963": "Medium", "402": "Medium", "496": "Easy", "503": "Medium", "739": "Medium", "901": "Medium", "907": "Medium", "962": "Medium", "1475": "Easy", "1673": "Medium", "150": "Medium", "224": "Hard", "227": "Medium", "772": "Hard", "71": "Medium", "394": "Medium", "735": "Medium", "155": "Medium", "895": "Hard", "84": "Hard", "85": "Hard",
  // Bit Manipulation
  "136": "Easy", "137": "Medium", "268": "Easy", "389": "Easy", "191": "Easy", "231": "Easy", "477": "Medium", "338": "Easy", "1494": "Hard", "1442": "Medium", "342": "Easy",
  // Linked Lists
  "83": "Easy", "92": "Medium", "206": "Easy", "25": "Hard", "234": "Easy", "82": "Medium", "21": "Easy", "2": "Medium", "369": "Medium", "160": "Easy", "599": "Easy", "24": "Medium", "61": "Medium", "86": "Medium", "143": "Medium", "328": "Medium",
  // Arrays
  "48": "Medium", "189": "Medium", "867": "Easy", "54": "Medium", "59": "Medium", "885": "Medium", "2326": "Medium", "73": "Medium", "289": "Medium", "498": "Medium", "238": "Medium", "845": "Medium", "2483": "Medium", "66": "Easy", "43": "Medium", "989": "Easy", "67": "Easy", "88": "Easy", "41": "Hard", "442": "Medium", "448": "Easy",
  // Strings
  "9": "Easy", "125": "Easy", "680": "Easy", "49": "Medium", "242": "Easy", "13": "Easy", "12": "Medium", "8": "Medium", "65": "Hard", "415": "Easy", "28": "Easy", "214": "Hard", "686": "Medium", "796": "Easy", "3008": "Hard", "459": "Easy",
  // Design & Tries
  "146": "Medium", "225": "Easy", "232": "Easy", "251": "Medium", "271": "Medium", "341": "Medium", "353": "Medium", "359": "Easy", "362": "Medium", "379": "Medium", "380": "Medium", "432": "Hard", "460": "Hard", "604": "Easy", "622": "Medium", "641": "Medium", "642": "Hard", "706": "Easy", "715": "Hard", "900": "Medium", "981": "Medium", "1146": "Medium", "1348": "Medium", "1352": "Medium", "1381": "Medium", "1756": "Medium", "2013": "Medium", "2034": "Medium", "2296": "Hard", "2336": "Medium", "208": "Medium", "211": "Medium", "720": "Medium", "648": "Medium", "425": "Hard", "745": "Hard"
};

const generateLeetCodeLink = (title: string): string => {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  return `https://leetcode.com/problems/${slug}/`;
};

const parseQuestions = (raw: string): Question[] => {
  return raw.split(',').map((item) => {
    const trimmed = item.trim();
    const match = trimmed.match(/^(\d+)\.\s*(.*)$/);
    if (match) {
      const id = match[1];
      const title = match[2];
      const difficulty = DIFFICULTY_MAP[id] || "Medium"; // Default to Medium if not in map
      return {
        id,
        title,
        fullTitle: trimmed,
        link: generateLeetCodeLink(title),
        difficulty,
      };
    }
    return {
      id: trimmed,
      title: trimmed,
      fullTitle: trimmed,
      link: `https://leetcode.com/search/?q=${encodeURIComponent(trimmed)}`,
      difficulty: "Medium",
    };
  });
};

export const DSA_DATA: Section[] = [
  {
    id: 'S1',
    title: 'I. Two Pointer Patterns',
    patterns: [
      {
        id: 'P1',
        name: 'Pattern 1: Converging',
        videoLink: 'https://www.youtube.com/watch?v=DKWEYzF2xJU&list=PL2SB3o9_VW78xKoiCPtzLnTWjMOklYlNy',
        questions: parseQuestions('11. Container With Most Water, 15. 3Sum, 16. 3Sum Closest, 18. 4Sum, 167. Two Sum II - Input Array Is Sorted, 349. Intersection of Two Arrays, 881. Boats to Save People, 977. Squares of a Sorted Array, 259. 3Sum Smaller'),
      },
      {
        id: 'P2',
        name: 'Pattern 2: Fast & Slow',
        questions: parseQuestions('141. Linked List Cycle, 202. Happy Number, 287. Find the Duplicate Number, 392. Is Subsequence'),
      },
      {
        id: 'P3',
        name: 'Pattern 3: Fixed Separation',
        questions: parseQuestions('19. Remove Nth Node From End of List, 876. Middle of the Linked List, 2095. Delete the Middle Node of a Linked List'),
      },
      {
        id: 'P4',
        name: 'Pattern 4: In-place Array Modification',
        questions: parseQuestions('26. Remove Duplicates from Sorted Array, 27. Remove Element, 75. Sort Colors, 80. Remove Duplicates from Sorted Array II, 283. Move Zeroes, 443. String Compression, 905. Sort Array By Parity, 2337. Move Pieces to Obtain a String, 2938. Separate Black and White Balls'),
      },
      {
        id: 'P5',
        name: 'Pattern 5: String Comparison with special characters',
        questions: parseQuestions('844. Backspace String Compare, 1598. Crawler Log Folder, 2390. Removing Stars From a String'),
      },
      {
        id: 'P6',
        name: 'Pattern 6: Expanding From Center',
        questions: parseQuestions('5. Longest Palindromic Substring, 647. Palindromic Substrings'),
      },
      {
        id: 'P7',
        name: 'Pattern 7: String Reversal',
        questions: parseQuestions('151. Reverse Words in a String, 344. Reverse String, 345. Reverse Vowels of a String, 541. Reverse String II'),
      },
    ],
  },
  {
    id: 'S2',
    title: 'II. Sliding Window Patterns',
    patterns: [
      {
        id: 'P8',
        name: 'Pattern 8: Fixed Size',
        videoLink: 'https://www.youtube.com/watch?v=DKWEYzF2xJU&list=PL2SB3o9_VW78xKoiCPtzLnTWjMOklYlNy',
        questions: parseQuestions('346. Moving Average from Data Stream, 643. Maximum Average Subarray I, 2985. Calculate Compressed Mean, 3254. Find the Power of K-Size Subarrays I, 3318. Find X-Sum of All K-Long Subarrays I'),
      },
      {
        id: 'P9',
        name: 'Pattern 9: Variable Size',
        questions: parseQuestions('3. Longest Substring Without Repeating Characters, 76. Minimum Window Substring, 209. Minimum Size Subarray Sum, 219. Contains Duplicate II, 424. Longest Repeating Character Replacement, 713. Subarray Product Less Than K, 904. Fruit Into Baskets, 1004. Max Consecutive Ones III, 1438. Longest Continuous Subarray With Absolute Diff Less Than or Equal to Limit, 1493. Longest Subarray of 1s After Deleting One Element, 1658. Minimum Operations to Reduce X to Zero, 1838. Frequency of the Most Frequent Element, 2461. Maximum Sum of Distinct Subarrays With Length K, 2516. Take K of Each Character From Left and Right, 2762. Continuous Subarrays, 2779. Maximum Beauty of an Array After Applying Operation, 2981. Find Longest Special Substring That Occurs Thrice I, 3026. Maximum Good Subarray Sum, 3346. Maximum Frequency of an Element After Performing Operations I, 3347. Maximum Frequency of an Element After Performing Operations II'),
      },
      {
        id: 'P10',
        name: 'Pattern 10: Monotonic Queue for Max/Min',
        questions: parseQuestions('239. Sliding Window Maximum, 862. Shortest Subarray with Sum at Least K, 1696. Jump Game VI'),
      },
      {
        id: 'P11',
        name: 'Pattern 11: Character Frequency Matching',
        questions: parseQuestions('1. Two Sum, 438. Find All Anagrams in a String, 567. Permutation in String'),
      },
    ],
  },
  {
    id: 'S3',
    title: 'III. Tree Traversal Patterns (DFS & BFS)',
    patterns: [
      {
        id: 'P12',
        name: 'Pattern 12: Level Order Traversal',
        questions: parseQuestions('102. Binary Tree Level Order Traversal, 103. Binary Tree Zigzag Level Order Traversal, 199. Binary Tree Right Side View, 515. Find Largest Value in Each Tree Row, 1161. Maximum Level Sum of a Binary Tree'),
      },
      {
        id: 'P13',
        name: 'Pattern 13: Recursive Preorder Traversal',
        questions: parseQuestions('100. Same Tree, 101. Symmetric Tree, 105. Construct Binary Tree from Preorder and Inorder Traversal, 114. Flatten Binary Tree to Linked List, 226. Invert Binary Tree, 257. Binary Tree Paths, 988. Smallest String Starting From Leaf'),
      },
      {
        id: 'P14',
        name: 'Pattern 14: Recursive Inorder Traversal',
        questions: parseQuestions('94. Binary Tree Inorder Traversal, 98. Validate Binary Search Tree, 173. Binary Search Tree Iterator, 230. Kth Smallest Element in a BST, 501. Find Mode in Binary Search Tree, 530. Minimum Absolute Difference in BST'),
      },
      {
        id: 'P15',
        name: 'Pattern 15: Recursive Postorder Traversal',
        questions: parseQuestions('104. Maximum Depth of Binary Tree, 110. Balanced Binary Tree, 124. Binary Tree Maximum Path Sum, 145. Binary Tree Postorder Traversal, 337. House Robber III, 366. Find Leaves of Binary Tree, 543. Diameter of Binary Tree, 863. All Nodes Distance K in Binary Tree, 1110. Delete Nodes And Return Forest, 2458. Height of Binary Tree After Subtree Removal Queries'),
      },
      {
        id: 'P16',
        name: 'Pattern 16: Lowest Common Ancestor',
        questions: parseQuestions('235. Lowest Common Ancestor of a Binary Search Tree, 236. Lowest Common Ancestor of a Binary Tree'),
      },
      {
        id: 'P17',
        name: 'Pattern 17: Serialization and Deserialization',
        questions: parseQuestions('297. Serialize and Deserialize Binary Tree, 572. Subtree of Another Tree, 652. Find Duplicate Subtrees'),
      },
    ],
  },
  {
    id: 'S4',
    title: 'IV. Graph Traversal Patterns (DFS & BFS)',
    patterns: [
      {
        id: 'P18',
        name: 'Pattern 18: DFS - Connected Components / Island Counting',
        questions: parseQuestions('130. Surrounded Regions, 200. Number of Islands, 417. Pacific Atlantic Water Flow, 547. Number of Provinces, 695. Max Area of Island, 733. Flood Fill, 841. Keys and Rooms, 1020. Number of Enclaves, 1254. Number of Closed Islands, 1905. Count Sub Islands, 2101. Detonate the Maximum Bombs'),
      },
      {
        id: 'P19',
        name: 'Pattern 19: BFS - Connected Components / Island Counting',
        questions: parseQuestions('542. 01 Matrix, 994. Rotting Oranges, 1091. Shortest Path in Binary Matrix'),
      },
      {
        id: 'P20',
        name: 'Pattern 20: DFS - Cycle Detection',
        questions: parseQuestions('207. Course Schedule, 210. Course Schedule II, 802. Find Eventual Safe States, 1059. All Paths from Source Lead to Destination'),
      },
      {
        id: 'P21',
        name: 'Pattern 21: BFS - Topological Sort(Kahn Algorithm)',
        questions: parseQuestions('210. Course Schedule II, 269. Alien Dictionary, 310. Minimum Height Trees, 444. Sequence Reconstruction, 1136. Parallel Courses, 1857. Largest Color Value in a Directed Graph, 2050. Parallel Courses III, 2115. Find All Possible Recipes from Given Supplies, 2392. Build a Matrix With Conditions'),
      },
      {
        id: 'P22',
        name: 'Pattern 22: Deep Copy / Cloning',
        questions: parseQuestions('133. Clone Graph, 1334. Find the City With the Smallest Number of Neighbors at a Threshold Distance, 138. Copy List with Random Pointer, 1490. Clone N-ary Tree'),
      },
      {
        id: 'P23',
        name: 'Pattern 23: Shortest Path',
        questions: parseQuestions('743. Network Delay Time, 778. Swim in Rising Water, 1514. Path with Maximum Probability, 1631. Path With Minimum Effort, 1976. Number of Ways to Arrive at Destination, 2045. Second Minimum Time to Reach Destination, 2203. Minimum Weighted Subgraph With the Required Paths, 2290. Minimum Obstacle Removal to Reach Corner, 2577. Minimum Time to Visit a Cell In a Grid, 2812. Find the Safest Path in a Grid'),
      },
      {
        id: 'P24',
        name: 'Pattern 24: Shortest Path (Bellman-Ford / BFS+K)',
        questions: parseQuestions('787. Cheapest Flights Within K Stops, 1129. Shortest Path with Alternating Colors'),
      },
      {
        id: 'P25',
        name: 'Pattern 25: Union-Find',
        questions: parseQuestions('200. Number of Islands, 261. Graph Valid Tree, 305. Number of Islands II, 323. Number of Connected Components in an Undirected Graph, 547. Number of Provinces, 684. Redundant Connection, 721. Accounts Merge, 737. Sentence Similarity II, 947. Most Stones Removed with Same Row or Column, 952. Largest Component Size by Common Factor, 959. Regions Cut By Slashes, 1101. The Earliest Moment When Everyone Become Friends'),
      },
      {
        id: 'P26',
        name: 'Pattern 26: Strongly Connected Components',
        questions: parseQuestions('210. Course Schedule II, 547. Number of Provinces, 1192. Critical Connections in a Network, 2127. Maximum Employees to Be Invited to a Meeting'),
      },
      {
        id: 'P27',
        name: 'Pattern 27: Bridges & Articulation Points',
        questions: parseQuestions('1192. Critical Connections in a Network, 2360. Longest Cycle in a Graph'),
      },
      {
        id: 'P28',
        name: 'Pattern 28: Minimum Spanning Tree',
        questions: parseQuestions('1135. Connecting Cities With Minimum Cost, 1584. Min Cost to Connect All Points, 1168. Optimize Water Distribution in a Village, 1489. Find Critical and Pseudo-Critical Edges in Minimum Spanning Tree'),
      },
      {
        id: 'P29',
        name: 'Pattern 29: Bidirectional BFS',
        questions: parseQuestions('127. Word Ladder, 126. Word Ladder II, 815. Bus Routes'),
      },
    ],
  },
  {
    id: 'S5',
    title: 'V. Dynamic Programming (DP) Patterns',
    patterns: [
      {
        id: 'P30',
        name: 'Pattern 30: Fibonacci Style',
        questions: parseQuestions('70. Climbing Stairs, 91. Decode Ways, 198. House Robber, 213. House Robber II, 337. House Robber III, 509. Fibonacci Number, 740. Delete and Earn, 746. Min Cost Climbing Stairs'),
      },
      {
        id: 'P31',
        name: 'Pattern 31: Kadanes Algorithm',
        questions: parseQuestions('53. Maximum Subarray, 918. Maximum Sum Circular Subarray, 2321. Maximum Score Of Spliced Array, 1749. Maximum Absolute Sum of Any Subarray, 152. Maximum Product Subarray'),
      },
      {
        id: 'P32',
        name: 'Pattern 32: Coin Change / Unbounded Knapsack',
        questions: parseQuestions('322. Coin Change, 377. Combination Sum IV, 518. Coin Change II'),
      },
      {
        id: 'P33',
        name: 'Pattern 33: 0/1 Knapsack, Subset Sum Style',
        questions: parseQuestions('416. Partition Equal Subset Sum, 494. Target Sum'),
      },
      {
        id: 'P34',
        name: 'Pattern 34: Word Break Style',
        questions: parseQuestions('139. Word Break, 140. Word Break II'),
      },
      {
        id: 'P35',
        name: 'Pattern 35: Longest Common Subsequence - LCS',
        questions: parseQuestions('1143. Longest Common Subsequence, 1092. Shortest Common Supersequence, 1312. Minimum Insertion Steps to Make a String Palindrome'),
      },
      {
        id: 'P36',
        name: 'Pattern 36: Edit Distance',
        questions: parseQuestions('72. Edit Distance, 583. Delete Operation for Two Strings, 712. Minimum ASCII Delete Sum for Two Strings'),
      },
      {
        id: 'P37',
        name: 'Pattern 37: Unique Paths on Grid',
        questions: parseQuestions('62. Unique Paths, 63. Unique Paths II, 64. Minimum Path Sum, 120. Triangle, 221. Maximal Square, 931. Minimum Falling Path Sum, 1277. Count Square Submatrices with All Ones'),
      },
      {
        id: 'P38',
        name: 'Pattern 38: Interval DP',
        questions: parseQuestions('312. Burst Balloons, 546. Remove Boxes'),
      },
      {
        id: 'P39',
        name: 'Pattern 39: Catalan Numbers',
        questions: parseQuestions('95. Unique Binary Search Trees II, 96. Unique Binary Search Trees, 241. Different Ways to Add Parentheses'),
      },
      {
        id: 'P40',
        name: 'Pattern 40: Longest Increasing Subsequence',
        questions: parseQuestions('300. Longest Increasing Subsequence, 354. Russian Doll Envelopes, 1671. Minimum Number of Removals to Make Mountain Array, 2407. Longest Increasing Subsequence II'),
      },
      {
        id: 'P41',
        name: 'Pattern 41: Stock Problems',
        questions: parseQuestions('121. Best Time to Buy and Sell Stock, 122. Best Time to Buy and Sell Stock II, 123. Best Time to Buy and Sell Stock III, 188. Best Time to Buy and Sell Stock IV, 309. Best Time to Buy and Sell Stock with Cooldown'),
      },
    ],
  },
  {
    id: 'S6',
    title: 'VI. Heap (Priority Queue) Patterns',
    patterns: [
      {
        id: 'P42',
        name: 'Pattern 42: Top K Elements',
        questions: parseQuestions('215. Kth Largest Element in an Array, 347. Top K Frequent Elements, 451. Sort Characters By Frequency, 506. Relative Ranks, 703. Kth Largest Element in a Stream, 973. K Closest Points to Origin, 1046. Last Stone Weight, 2558. Take Gifts From the Richest Pile'),
      },
      {
        id: 'P43',
        name: 'Pattern 43: Two Heaps for Median Finding',
        questions: parseQuestions('295. Find Median from Data Stream, 1825. Finding MK Average'),
      },
      {
        id: 'P44',
        name: 'Pattern 44: K-way Merge',
        questions: parseQuestions('23. Merge k Sorted Lists, 373. Find K Pairs with Smallest Sums, 378. Kth Smallest Element in a Sorted Matrix, 632. Smallest Range Covering Elements from K Lists'),
      },
      {
        id: 'P45',
        name: 'Pattern 45: Scheduling / Minimum Cost',
        questions: parseQuestions('253. Meeting Rooms II, 767. Reorganize String, 857. Minimum Cost to Hire K Workers, 1642. Furthest Building You Can Reach, 1792. Maximum Average Pass Ratio, 1834. Single-Threaded CPU, 1942. The Number of the Smallest Unoccupied Chair, 2402. Meeting Rooms III'),
      },
    ],
  },
  {
    id: 'S7',
    title: 'VII. Backtracking Patterns',
    patterns: [
      {
        id: 'P46',
        name: 'Pattern 46: Subsets (Include/Exclude)',
        questions: parseQuestions('17. Letter Combinations of a Phone Number, 77. Combinations, 78. Subsets, 90. Subsets II'),
      },
      {
        id: 'P47',
        name: 'Pattern 47: Permutations',
        questions: parseQuestions('31. Next Permutation, 46. Permutations, 60. Permutation Sequence'),
      },
      {
        id: 'P48',
        name: 'Pattern 48: Combination Sum',
        questions: parseQuestions('39. Combination Sum, 40. Combination Sum II'),
      },
      {
        id: 'P49',
        name: 'Pattern 49: Parentheses Generation',
        questions: parseQuestions('22. Generate Parentheses, 301. Remove Invalid Parentheses'),
      },
      {
        id: 'P50',
        name: 'Pattern 50: Word Search / Path Finding',
        questions: parseQuestions('79. Word Search, 212. Word Search II, 2018. Check if Word Can Be Placed In Crossword'),
      },
      {
        id: 'P51',
        name: 'Pattern 51: N-Queens / Constraint Satisfaction',
        questions: parseQuestions('37. Sudoku Solver, 51. N-Queens'),
      },
      {
        id: 'P52',
        name: 'Pattern 52: Palindrome Partitioning',
        questions: parseQuestions('131. Palindrome Partitioning, 132. Palindrome Partitioning II, 1457. Pseudo-Palindromic Paths in a Binary Tree'),
      },
    ],
  },
  {
    id: 'S8',
    title: 'VIII. Greedy Patterns',
    patterns: [
      {
        id: 'P53',
        name: 'Pattern 53: Interval Merging/Scheduling',
        questions: parseQuestions('56. Merge Intervals, 57. Insert Interval, 759. Employee Free Time, 986. Interval List Intersections, 2406. Divide Intervals Into Minimum Number of Groups'),
      },
      {
        id: 'P54',
        name: 'Pattern 54: Jump Game',
        questions: parseQuestions('45. Jump Game II, 55. Jump Game'),
      },
      {
        id: 'P55',
        name: 'Pattern 55: Buy/Sell Stock',
        questions: parseQuestions('121. Best Time to Buy and Sell Stock, 122. Best Time to Buy and Sell Stock II'),
      },
      {
        id: 'P56',
        name: 'Pattern 56: Gas Station Circuit',
        questions: parseQuestions('134. Gas Station, 2202. Maximize the Topmost Element After K Moves'),
      },
      {
        id: 'P57',
        name: 'Pattern 57: Task Scheduling',
        questions: parseQuestions('621. Task Scheduler, 767. Reorganize String, 1054. Distant Barcodes'),
      },
      {
        id: 'P58',
        name: 'Pattern 58: Sorting Based',
        questions: parseQuestions('455. Assign Cookies, 135. Candy, 406. Queue Reconstruction by Height, 1029. Two City Scheduling'),
      },
    ],
  },
  {
    id: 'S9',
    title: 'IX. Binary Search Patterns',
    patterns: [
      {
        id: 'P59',
        name: 'Pattern 59: On Sorted Array/List',
        questions: parseQuestions('35. Search Insert Position, 69. Sqrt(x), 74. Search a 2D Matrix, 278. First Bad Version, 374. Guess Number Higher or Lower, 540. Single Element in a Sorted Array, 704. Binary Search, 1539. Kth Missing Positive Number'),
      },
      {
        id: 'P60',
        name: 'Pattern 60: Rotated Sorted Array',
        questions: parseQuestions('33. Search in Rotated Sorted Array, 81. Search in Rotated Sorted Array II, 153. Find Minimum in Rotated Sorted Array, 162. Find Peak Element, 852. Peak Index in a Mountain Array, 1095. Find in Mountain Array'),
      },
      {
        id: 'P61',
        name: 'Pattern 61: On Answer / Condition Function',
        questions: parseQuestions('410. Split Array Largest Sum, 774. Minimize Max Distance to Gas Station, 875. Koko Eating Bananas, 1011. Capacity To Ship Packages Within D Days, 1482. Minimum Number of Days to Make m Bouquets, 1760. Minimum Limit of Balls in a Bag, 2064. Minimized Maximum of Products Distributed to Any Store, 2226. Maximum Candies Allocated to K Children'),
      },
      {
        id: 'P62',
        name: 'Pattern 62: Find First/Last Occurrence',
        questions: parseQuestions('34. Find First and Last Position of Element in Sorted Array, 658. Find K Closest Elements'),
      },
      {
        id: 'P63',
        name: 'Pattern 63: Median / Kth across Two Arrays',
        questions: parseQuestions('4. Median of Two Sorted Arrays, 719. Find K-th Smallest Pair Distance, 378. Kth Smallest Element in a Sorted Matrix'),
      },
    ],
  },
  {
    id: 'S10',
    title: 'X. Stack Patterns',
    patterns: [
      {
        id: 'P64',
        name: 'Pattern 64: Valid Parentheses Matching',
        questions: parseQuestions('20. Valid Parentheses, 32. Longest Valid Parentheses, 921. Minimum Add to Make Parentheses Valid, 1249. Minimum Remove to Make Valid Parentheses, 1963. Minimum Number of Swaps to Make the String Balanced'),
      },
      {
        id: 'P65',
        name: 'Pattern 65: Monotonic Stack',
        questions: parseQuestions('402. Remove K Digits, 496. Next Greater Element I, 503. Next Greater Element II, 739. Daily Temperatures, 901. Online Stock Span, 907. Sum of Subarray Minimums, 962. Maximum Width Ramp, 1475. Final Prices With a Special Discount in a Shop, 1673. Find the Most Competitive Subsequence'),
      },
      {
        id: 'P66',
        name: 'Pattern 66: Expression Evaluation',
        questions: parseQuestions('150. Evaluate Reverse Polish Notation, 224. Basic Calculator, 227. Basic Calculator II, 772. Basic Calculator III'),
      },
      {
        id: 'P67',
        name: 'Pattern 67: Simulation / Helper',
        questions: parseQuestions('71. Simplify Path, 394. Decode String, 735. Asteroid Collision'),
      },
      {
        id: 'P68',
        name: 'Pattern 68: Min Stack Design',
        questions: parseQuestions('155. Min Stack, 895. Maximum Frequency Stack, 901. Online Stock Span'),
      },
      {
        id: 'P69',
        name: 'Pattern 69: Largest Rectangle in Histogram',
        questions: parseQuestions('84. Largest Rectangle in Histogram, 85. Maximal Rectangle'),
      },
    ],
  },
  {
    id: 'S11',
    title: 'XI. Bit Manipulation Patterns',
    patterns: [
      {
        id: 'P70',
        name: 'Pattern 70: Bitwise XOR',
        questions: parseQuestions('136. Single Number, 137. Single Number II, 268. Missing Number, 389. Find the Difference'),
      },
      {
        id: 'P71',
        name: 'Pattern 71: Bitwise AND - Counting Bits',
        questions: parseQuestions('191. Number of 1 Bits, 231. Power of Two, 477. Total Hamming Distance'),
      },
      {
        id: 'P72',
        name: 'Pattern 72: Bitwise DP',
        questions: parseQuestions('338. Counting Bits, 1494. Parallel Courses II, 1442. Count Triplets That Can Form Two Arrays of Equal XOR'),
      },
      {
        id: 'P73',
        name: 'Pattern 73: Bitwise Operations',
        questions: parseQuestions('231. Power of Two, 342. Power of Four'),
      },
    ],
  },
  {
    id: 'S12',
    title: 'XII. Linked List Manipulation Patterns',
    patterns: [
      {
        id: 'P74',
        name: 'Pattern 74: In-place Reversal',
        questions: parseQuestions('83. Remove Duplicates from Sorted List, 92. Reverse Linked List II, 206. Reverse Linked List, 25. Reverse Nodes in k-Group, 234. Palindrome Linked List, 82. Remove Duplicates from Sorted List II'),
      },
      {
        id: 'P75',
        name: 'Pattern 75: Merging Two Sorted Lists',
        questions: parseQuestions('21. Merge Two Sorted Lists, 23. Merge k Sorted Lists'),
      },
      {
        id: 'P76',
        name: 'Pattern 76: Addition of Numbers',
        questions: parseQuestions('2. Add Two Numbers, 369. Plus One Linked List'),
      },
      {
        id: 'P77',
        name: 'Pattern 77: Intersection Detection',
        questions: parseQuestions('160. Intersection of Two Linked Lists, 599. Minimum Index Sum of Two Lists'),
      },
      {
        id: 'P78',
        name: 'Pattern 78: Reordering / Partitioning',
        questions: parseQuestions('24. Swap Nodes in Pairs, 61. Rotate List, 86. Partition List, 143. Reorder List, 328. Odd Even Linked List'),
      },
    ],
  },
  {
    id: 'S13',
    title: 'XIII. Array/Matrix Manipulation Patterns',
    patterns: [
      {
        id: 'P79',
        name: 'Pattern 79: In-place Rotation',
        questions: parseQuestions('48. Rotate Image, 189. Rotate Array, 867. Transpose Matrix'),
      },
      {
        id: 'P80',
        name: 'Pattern 80: Spiral Traversal',
        questions: parseQuestions('54. Spiral Matrix, 59. Spiral Matrix II, 885. Spiral Matrix III, 2326. Spiral Matrix IV'),
      },
      {
        id: 'P81',
        name: 'Pattern 81: In-place Marking',
        questions: parseQuestions('73. Set Matrix Zeroes, 289. Game of Life, 498. Diagonal Traverse'),
      },
      {
        id: 'P82',
        name: 'Pattern 82: Prefix/Suffix Products',
        questions: parseQuestions('238. Product of Array Except Self, 845. Longest Mountain in Array, 2483. Minimum Penalty for a Shop'),
      },
      {
        id: 'P83',
        name: 'Pattern 83: Plus One Logic',
        questions: parseQuestions('66. Plus One, 43. Multiply Strings, 989. Add to Array-Form of Integer, 67. Add Binary'),
      },
      {
        id: 'P84',
        name: 'Pattern 84: In-place from End',
        questions: parseQuestions('88. Merge Sorted Array, 977. Squares of a Sorted Array'),
      },
      {
        id: 'P85',
        name: 'Pattern 85: Cyclic Sort',
        questions: parseQuestions('41. First Missing Positive, 268. Missing Number, 287. Find the Duplicate Number, 442. Find All Duplicates in an Array, 448. Find All Numbers Disappeared in an Array'),
      },
    ],
  },
  {
    id: 'S14',
    title: 'XIV. String Manipulation Patterns',
    patterns: [
      {
        id: 'P86',
        name: 'Pattern 86: Palindrome Check',
        questions: parseQuestions('9. Palindrome Number, 125. Valid Palindrome, 680. Valid Palindrome II'),
      },
      {
        id: 'P87',
        name: 'Pattern 87: Anagram Check',
        questions: parseQuestions('49. Group Anagrams, 242. Valid Anagram'),
      },
      {
        id: 'P88',
        name: 'Pattern 88: Roman to Integer Conversion',
        questions: parseQuestions('13. Roman to Integer, 12. Integer to Roman'),
      },
      {
        id: 'P89',
        name: 'Pattern 89: String to Integer (atoi)',
        questions: parseQuestions('8. String to Integer (atoi), 65. Valid Number'),
      },
      {
        id: 'P90',
        name: 'Pattern 90: Manual Simulation',
        questions: parseQuestions('43. Multiply Strings, 415. Add Strings, 67. Add Binary'),
      },
      {
        id: 'P91',
        name: 'Pattern 91: String Matching - Naive / KMP',
        questions: parseQuestions('28. Find the Index of the First Occurrence in a String, 214. Shortest Palindrome, 686. Repeated String Match, 796. Rotate String, 3008. Find Beautiful Indices in the Given Array II'),
      },
      {
        id: 'P92',
        name: 'Pattern 92: Repeated Substring Pattern',
        questions: parseQuestions('459. Repeated Substring Pattern, 28. Find the Index of the First Occurrence in a String, 686. Repeated String Match'),
      },
    ],
  },
  {
    id: 'S15',
    title: 'XV. Design Patterns',
    patterns: [
      {
        id: 'P93',
        name: 'Pattern 93: Design (General/Specific)',
        questions: parseQuestions('146. LRU Cache, 155. Min Stack, 225. Implement Stack using Queues, 232. Implement Queue using Stacks, 251. Flatten 2D Vector, 271. Encode and Decode Strings, 295. Find Median from Data Stream, 341. Flatten Nested List Iterator, 346. Moving Average from Data Stream, 353. Design Snake Game, 359. Logger Rate Limiter, 362. Design Hit Counter, 379. Design Phone Directory, 380. Insert Delete GetRandom O(1), 432. All O`one Data Structure, 460. LFU Cache, 604. Design Compressed String Iterator, 622. Design Circular Queue, 641. Design Circular Deque, 642. Design Search Autocomplete System, 706. Design HashMap, 715. Range Module, 900. RLE Iterator, 981. Time Based Key-Value Store, 1146. Snapshot Array, 1348. Tweet Counts Per Frequency, 1352. Product of the Last K Numbers, 1381. Design a Stack With Increment Operation, 1756. Design Most Recently Used Queue, 2013. Detect Squares, 2034. Stock Price Fluctuation, 2296. Design a Text Editor, 2336. Smallest Number in Infinite Set'),
      },
      {
        id: 'P94',
        name: 'Pattern 94: Tries',
        questions: parseQuestions('208. Implement Trie (Prefix Tree), 211. Design Add and Search Words Data Structure, 720. Longest Word in Dictionary, 648. Replace Words, 425. Word Squares, 642. Design Search Autocomplete System, 745. Prefix and Suffix Search'),
      },
    ],
  },
];
