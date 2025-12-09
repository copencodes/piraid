 // Application state
        let scanHistory = [];
        let totalScans = 0;
        let currentScanMode = 'piracy'; // 'piracy' or 'plagiarism'

        // Navigation functionality
        document.addEventListener('DOMContentLoaded', function() {
            const navLinks = document.querySelectorAll('.nav-link');
            const sections = document.querySelectorAll('.section');
            const heroSection = document.getElementById('home-hero');

            function showSection(sectionId) {
                sections.forEach(section => {
                    section.classList.remove('active');
                });

                navLinks.forEach(link => {
                    link.classList.remove('active');
                });

                // Hide hero if not on home
                if (sectionId === 'home') {
                    heroSection.style.display = 'block';
                } else {
                    heroSection.style.display = 'none';
                }

                const targetSection = document.getElementById(sectionId);
                if (targetSection) {
                    targetSection.classList.add('active');
                }

                const activeLink = document.querySelector(`[data-section="${sectionId}"]`);
                if (activeLink && activeLink.classList.contains('nav-link')) {
                    activeLink.classList.add('active');
                }

                // Scroll to top
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }

            // Navigation event listeners
            document.addEventListener('click', function(e) {
                if (e.target.classList.contains('nav-link') || e.target.closest('[data-section]')) {
                    e.preventDefault();
                    const target = e.target.classList.contains('nav-link') ? e.target : e.target.closest('[data-section]');
                    const sectionId = target.getAttribute('data-section');
                    if (sectionId) {
                        showSection(sectionId);
                    }
                }
            });

            // Scan mode switcher
            const scanTypeBtns = document.querySelectorAll('.scan-type-btn');
            const scanModes = document.querySelectorAll('.scan-mode');

            scanTypeBtns.forEach(btn => {
                btn.addEventListener('click', function() {
                    const mode = this.getAttribute('data-mode');
                    currentScanMode = mode;

                    // Update button states
                    scanTypeBtns.forEach(b => b.classList.remove('active'));
                    this.classList.add('active');

                    // Update scan mode visibility
                    scanModes.forEach(m => m.classList.remove('active'));
                    const targetMode = document.getElementById(mode + 'Mode');
                    if (targetMode) {
                        targetMode.classList.add('active');
                    }

                    // Reset results
                    document.getElementById('resultsSection').classList.remove('active');
                    document.getElementById('progressSection').classList.remove('active');
                    document.getElementById('errorMessage').classList.remove('active');
                });
            });

            // Scan functionality
            const scanButton = document.getElementById('scanButton');
            const progressSection = document.getElementById('progressSection');
            const resultsSection = document.getElementById('resultsSection');
            const errorMessage = document.getElementById('errorMessage');
            const apiKeyInput = document.getElementById('apiKey');

            scanButton.addEventListener('click', function() {
                const apiKey = apiKeyInput.value.trim();

                // Validate API key
                if (!apiKey) {
                    showError('Please enter your ScrapingBee API key');
                    return;
                }

                // Route to appropriate scan function
                if (currentScanMode === 'piracy') {
                    const contentName = document.getElementById('contentName').value.trim();
                    if (!contentName) {
                        showError('Please enter the content name to search for');
                        return;
                    }
                    startPiracyDetection(apiKey, contentName);
                } else {
                    const plagiarismText = document.getElementById('plagiarismText').value.trim();
                    if (!plagiarismText || plagiarismText.length < 50) {
                        showError('Please enter at least 50 characters of text to check for plagiarism');
                        return;
                    }
                    startPlagiarismCheck(apiKey, plagiarismText);
                }

                // Hide error message
                errorMessage.classList.remove('active');
            });

            function showError(message) {
                errorMessage.textContent = message;
                errorMessage.classList.add('active');
            }

            // PIRACY DETECTION FUNCTIONS
            async function startPiracyDetection(apiKey, contentName) {
                showProgress('piracy');

                try {
                    const searchQueries = [
                        `"${contentName}" download free`,
                        `"${contentName}" torrent`,
                        `"${contentName}" watch online free`,
                        `"${contentName}" pirated`
                    ];

                    let allResults = [];

                    for (const query of searchQueries) {
                        try {
                            const results = await searchWithScrapingBee(apiKey, query);
                            allResults = allResults.concat(results);
                        } catch (error) {
                            console.error('Search error:', error);
                        }
                    }

                    completeProgress();
                    setTimeout(() => {
                        showPiracyResults(allResults, contentName);
                    }, 500);

                } catch (error) {
                    hideProgress();
                    showError('Error during scan: ' + error.message + '. Please check your API key and try again.');
                }
            }

            async function searchWithScrapingBee(apiKey, query) {
                const endpoint = 'https://app.scrapingbee.com/api/v1/store/google';
                const params = new URLSearchParams({
                    'api_key': apiKey,
                    'search': query,
                    'nb_results': '10'
                });

                const url = `${endpoint}?${params.toString()}`;
                const response = await fetch(url);

                if (!response.ok) {
                    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
                }

                const data = await response.json();
                const results = [];

                if (data.organic_results && Array.isArray(data.organic_results)) {
                    data.organic_results.forEach(result => {
                        const title = (result.title || '').toLowerCase();
                        const snippet = (result.snippet || '').toLowerCase();
                        const url = (result.url || '').toLowerCase();

                        const piracyKeywords = ['free download', 'torrent', 'watch online', 'stream free', 
                                                'pirate', 'crack', 'keygen', 'full version free', 
                                                'no payment', 'free access', 'leaked'];

                        const hasPiracyIndicator = piracyKeywords.some(keyword => 
                            title.includes(keyword) || snippet.includes(keyword) || url.includes(keyword)
                        );

                        if (hasPiracyIndicator) {
                            results.push({
                                url: result.url,
                                title: result.title,
                                snippet: result.snippet,
                                platform: detectPlatform(result.url)
                            });
                        }
                    });
                }

                return results;
            }

            function detectPlatform(url) {
                const urlLower = url.toLowerCase();
                if (urlLower.includes('torrent')) return 'Torrent Network';
                if (urlLower.includes('stream')) return 'Streaming Site';
                if (urlLower.includes('download')) return 'Download Site';
                if (urlLower.includes('file')) return 'File Sharing';
                if (urlLower.includes('mega') || urlLower.includes('mediafire')) return 'File Hosting';
                return 'Suspicious Website';
            }

            function calculateConfidence(result) {
                const text = (result.title + ' ' + result.snippet + ' ' + result.url).toLowerCase();
                let confidence = 70;

                if (text.includes('torrent')) confidence += 10;
                if (text.includes('free download')) confidence += 8;
                if (text.includes('crack') || text.includes('keygen')) confidence += 12;
                if (text.includes('pirate')) confidence += 15;
                if (text.includes('watch online free')) confidence += 7;

                return Math.min(confidence, 99) + '%';
            }

            function showPiracyResults(sources, contentName) {
                progressSection.classList.remove('active');
                resultsSection.classList.add('active');

                const numSources = sources.length;
                let piracyPercentage = 0;

                if (numSources === 0) {
                    piracyPercentage = 0;
                } else if (numSources <= 3) {
                    piracyPercentage = 15;
                } else if (numSources <= 7) {
                    piracyPercentage = 35;
                } else if (numSources <= 15) {
                    piracyPercentage = 60;
                } else {
                    piracyPercentage = 85;
                }

                const riskLevel = piracyPercentage < 20 ? 'Low' : piracyPercentage < 50 ? 'Medium' : 'High';
                const riskClass = riskLevel.toLowerCase();

                document.getElementById('resultsTitle').textContent = 'Piracy Detection Results';
                document.getElementById('percentageText').textContent = piracyPercentage + '%';
                document.getElementById('percentageLabel').textContent = 'Piracy';
                document.getElementById('riskLevel').textContent = `Risk Level: ${riskLevel}`;
                document.getElementById('scanTimestamp').textContent = `Scanned: ${new Date().toLocaleString()}`;
                document.getElementById('sourcesFound').textContent = `Sources Found: ${numSources}`;

                const circle = document.getElementById('percentageCircle');
                circle.className = `percentage-circle risk-${riskClass}`;

                const sourcesTitle = document.getElementById('sourcesTitle');
                sourcesTitle.textContent = 'Detected Piracy Sources:';

                const sourcesContent = document.getElementById('sourcesContent');
                sourcesContent.innerHTML = '';

                if (numSources === 0) {
                    sourcesContent.innerHTML = '<p style="text-align: center; color: #28a745; font-weight: bold;">✓ No piracy sources detected! Your content appears to be well protected.</p>';
                } else {
                    sources.forEach(source => {
                        const sourceItem = document.createElement('div');
                        sourceItem.className = 'source-item';
                        sourceItem.innerHTML = `
                            <div class="source-url">${escapeHtml(source.url)}</div>
                            <div style="margin-top: 0.5rem;"><strong>Title:</strong> ${escapeHtml(source.title)}</div>
                            <div style="margin-top: 0.3rem; color: #666;">${escapeHtml(source.snippet)}</div>
                            <div class="source-details">
                                <span><strong>Platform:</strong> ${source.platform}</span>
                                <span><strong>Confidence:</strong> ${calculateConfidence(source)}</span>
                            </div>
                        `;
                        sourcesContent.appendChild(sourceItem);
                    });
                }

                totalScans++;
                scanHistory.push({
                    type: 'piracy',
                    contentName: contentName,
                    timestamp: new Date(),
                    percentage: piracyPercentage,
                    sourcesFound: numSources
                });
            }

            // PLAGIARISM DETECTION FUNCTIONS
            async function startPlagiarismCheck(apiKey, text) {
                showProgress('plagiarism');

                try {
                    // Extract key phrases from text
                    const phrases = extractKeyPhrases(text);
                    let allMatches = [];

                    // Search for each phrase
                    for (const phrase of phrases) {
                        try {
                            const matches = await searchExactPhrase(apiKey, phrase);
                            if (matches.length > 0) {
                                allMatches.push({
                                    phrase: phrase,
                                    matches: matches
                                });
                            }
                        } catch (error) {
                            console.error('Search error for phrase:', phrase, error);
                        }
                    }

                    completeProgress();
                    setTimeout(() => {
                        showPlagiarismResults(allMatches, text);
                    }, 500);

                } catch (error) {
                    hideProgress();
                    showError('Error during plagiarism check: ' + error.message);
                }
            }

            function extractKeyPhrases(text) {
                // Split text into sentences
                const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
                const phrases = [];

                // Extract meaningful phrases (5-15 words)
                sentences.forEach(sentence => {
                    const words = sentence.trim().split(/\s+/);

                    // Take full sentence if it's 5-15 words
                    if (words.length >= 5 && words.length <= 15) {
                        phrases.push(sentence.trim());
                    } else if (words.length > 15) {
                        // Break into chunks
                        for (let i = 0; i <= words.length - 8; i += 8) {
                            const chunk = words.slice(i, i + 12).join(' ');
                            if (chunk.length > 30) {
                                phrases.push(chunk);
                            }
                        }
                    }
                });

                // Limit to top 5 phrases
                return phrases.slice(0, 5);
            }

            async function searchExactPhrase(apiKey, phrase) {
                // Use Google search with exact phrase matching
                const endpoint = 'https://app.scrapingbee.com/api/v1/store/google';

                // Clean the phrase and wrap in quotes for exact matching
                const cleanPhrase = phrase.replace(/["]/g, '').trim();
                const searchQuery = `"${cleanPhrase}"`;

                const params = new URLSearchParams({
                    'api_key': apiKey,
                    'search': searchQuery,
                    'nb_results': '5'
                });

                const url = `${endpoint}?${params.toString()}`;
                const response = await fetch(url);

                if (!response.ok) {
                    throw new Error(`API request failed: ${response.status}`);
                }

                const data = await response.json();
                const matches = [];

                if (data.organic_results && Array.isArray(data.organic_results)) {
                    data.organic_results.forEach(result => {
                        matches.push({
                            url: result.url,
                            title: result.title,
                            snippet: result.snippet
                        });
                    });
                }

                return matches;
            }

            function showPlagiarismResults(matches, originalText) {
                progressSection.classList.remove('active');
                resultsSection.classList.add('active');

                const totalMatches = matches.reduce((sum, m) => sum + m.matches.length, 0);
                const uniquePhrases = matches.length;

                // Calculate plagiarism percentage
                let plagiarismPercentage = 0;
                if (uniquePhrases === 0) {
                    plagiarismPercentage = 0;
                } else if (uniquePhrases === 1) {
                    plagiarismPercentage = 15;
                } else if (uniquePhrases === 2) {
                    plagiarismPercentage = 35;
                } else if (uniquePhrases === 3) {
                    plagiarismPercentage = 55;
                } else if (uniquePhrases === 4) {
                    plagiarismPercentage = 75;
                } else {
                    plagiarismPercentage = 90;
                }

                const riskLevel = plagiarismPercentage < 20 ? 'Low' : plagiarismPercentage < 50 ? 'Medium' : 'High';
                const riskClass = riskLevel.toLowerCase();

                document.getElementById('resultsTitle').textContent = 'Plagiarism Check Results';
                document.getElementById('percentageText').textContent = plagiarismPercentage + '%';
                document.getElementById('percentageLabel').textContent = 'Match';
                document.getElementById('riskLevel').textContent = `Risk Level: ${riskLevel}`;
                document.getElementById('scanTimestamp').textContent = `Scanned: ${new Date().toLocaleString()}`;
                document.getElementById('sourcesFound').textContent = `Matching Phrases: ${uniquePhrases}`;

                const circle = document.getElementById('percentageCircle');
                circle.className = `percentage-circle risk-${riskClass}`;

                const sourcesTitle = document.getElementById('sourcesTitle');
                sourcesTitle.textContent = 'Plagiarism Matches Found:';

                const sourcesContent = document.getElementById('sourcesContent');
                sourcesContent.innerHTML = '';

                if (uniquePhrases === 0) {
                    sourcesContent.innerHTML = '<p style="text-align: center; color: #28a745; font-weight: bold;">✓ No plagiarism detected! Your text appears to be original.</p>';
                } else {
                    matches.forEach(match => {
                        const matchContainer = document.createElement('div');
                        matchContainer.className = 'plagiarism-match';

                        let matchHTML = `<div style="font-weight: bold; margin-bottom: 0.5rem;">Matched Phrase:</div>`;
                        matchHTML += `<div class="matched-text">${escapeHtml(match.phrase)}</div>`;
                        matchHTML += `<div style="margin-top: 1rem;"><strong>Found in ${match.matches.length} source(s):</strong></div>`;

                        match.matches.forEach(source => {
                            matchHTML += `
                                <div style="margin-top: 0.75rem; padding: 0.75rem; background: white; border-radius: 4px; border: 1px solid #ddd;">
                                    <div style="color: #dc3545; font-weight: bold; word-break: break-all;">${escapeHtml(source.url)}</div>
                                    <div style="margin-top: 0.3rem;"><strong>Title:</strong> ${escapeHtml(source.title)}</div>
                                    <div style="margin-top: 0.3rem; color: #666; font-size: 0.9rem;">${escapeHtml(source.snippet)}</div>
                                </div>
                            `;
                        });

                        matchContainer.innerHTML = matchHTML;
                        sourcesContent.appendChild(matchContainer);
                    });
                }

                totalScans++;
                scanHistory.push({
                    type: 'plagiarism',
                    textLength: originalText.length,
                    timestamp: new Date(),
                    percentage: plagiarismPercentage,
                    matchesFound: uniquePhrases
                });
            }

            // PROGRESS HELPERS
            function showProgress(type) {
                progressSection.classList.add('active');
                resultsSection.classList.remove('active');
                scanButton.disabled = true;

                const progressFill = document.getElementById('progressFill');
                const progressText = document.getElementById('progressText');
                const scanStatus = document.getElementById('scanStatus');

                let progress = 0;
                window.progressInterval = setInterval(() => {
                    if (progress < 90) {
                        progress += 5;
                        progressFill.style.width = progress + '%';
                        progressText.textContent = Math.round(progress) + '% complete';

                        if (type === 'piracy') {
                            if (progress < 30) {
                                scanStatus.textContent = 'Initializing search...';
                            } else if (progress < 60) {
                                scanStatus.textContent = 'Searching for pirated content...';
                            } else {
                                scanStatus.textContent = 'Analyzing results...';
                            }
                        } else {
                            if (progress < 30) {
                                scanStatus.textContent = 'Extracting key phrases...';
                            } else if (progress < 60) {
                                scanStatus.textContent = 'Searching for exact matches...';
                            } else {
                                scanStatus.textContent = 'Analyzing plagiarism...';
                            }
                        }
                    }
                }, 300);
            }

            function completeProgress() {
                if (window.progressInterval) {
                    clearInterval(window.progressInterval);
                }

                const progressFill = document.getElementById('progressFill');
                const progressText = document.getElementById('progressText');
                const scanStatus = document.getElementById('scanStatus');

                progressFill.style.width = '100%';
                progressText.textContent = '100% complete';
                scanStatus.textContent = 'Finalizing results...';
            }

            function hideProgress() {
                if (window.progressInterval) {
                    clearInterval(window.progressInterval);
                }
                progressSection.classList.remove('active');
                scanButton.disabled = false;
            }

            function escapeHtml(text) {
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            }
        });