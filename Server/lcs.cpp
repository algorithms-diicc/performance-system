#include <iostream>
#include <vector>
#include <string>
#include <fstream>

using namespace std;

string longest_common_substring(const string& str1, const string& str2) {
    int n = str1.length();
    int m = str2.length();
    vector<vector<int>> dp(n + 1, vector<int>(m + 1, 0));
    int maxlen = 0;
    int end = 0;

    for (int i = 1; i <= n; ++i) {
        for (int j = 1; j <= m; ++j) {
            if (str1[i - 1] == str2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
                if (dp[i][j] > maxlen) {
                    maxlen = dp[i][j];
                    end = i - 1;
                }
            }
        }
    }

    if (maxlen == 0) return "<empty>";

    return str1.substr(end - maxlen + 1, maxlen);
}

int main(int argc, char* argv[]) {
    if (argc < 2) {
        cerr << "Usage: " << argv[0] << " <input file>" << endl;
        return 1;
    }

    string input_file = argv[1];
    ifstream file(input_file);

    if (!file.is_open()) {
        cerr << "Error: Could not open file " << input_file << endl;
        return 1;
    }

    string content((istreambuf_iterator<char>(file)), (istreambuf_iterator<char>()));
    file.close();

    // Split the input into two halves
    int mid = content.size() / 2;
    string first_half = content.substr(0, mid);
    string second_half = content.substr(mid);

    // Find the longest common substring
    string lcs = longest_common_substring(first_half, second_half);

    cout << "Longest Common Substring: " << lcs << endl;
    return 0;
}
