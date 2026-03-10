package com.dsatracker.eclipse.ui;

import java.io.ByteArrayInputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

import org.eclipse.core.resources.IFile;
import org.eclipse.core.resources.IFolder;
import org.eclipse.core.resources.IProject;
import org.eclipse.core.resources.IWorkspaceRoot;
import org.eclipse.core.resources.ResourcesPlugin;
import org.eclipse.core.runtime.CoreException;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.core.runtime.NullProgressMonitor;
import org.eclipse.core.runtime.Path;
import org.eclipse.core.runtime.jobs.Job;
import org.eclipse.core.runtime.jobs.JobChangeAdapter;
import org.eclipse.core.runtime.jobs.IJobChangeEvent;
import org.eclipse.jface.dialogs.MessageDialog;
import org.eclipse.jface.viewers.ArrayContentProvider;
import org.eclipse.jface.viewers.DoubleClickEvent;
import org.eclipse.jface.viewers.IDoubleClickListener;
import org.eclipse.jface.viewers.ISelection;
import org.eclipse.jface.viewers.IStructuredSelection;
import org.eclipse.jface.viewers.LabelProvider;
import org.eclipse.jface.viewers.TreeViewer;
import org.eclipse.swt.SWT;
import org.eclipse.swt.layout.GridData;
import org.eclipse.swt.layout.GridLayout;
import org.eclipse.swt.widgets.Button;
import org.eclipse.swt.widgets.Composite;
import org.eclipse.swt.widgets.Text;
import org.eclipse.ui.IWorkbenchPage;
import org.eclipse.ui.PlatformUI;
import org.eclipse.ui.ide.IDE;
import org.eclipse.ui.part.ViewPart;

import com.dsatracker.eclipse.secure.EclipseSecureTokenStore;
import com.dsatracker.idecore.client.BackendClientConfig;
import com.dsatracker.idecore.client.BackendUrlResolver;
import com.dsatracker.idecore.client.DsaBackendClient;
import com.dsatracker.idecore.model.QuestionV1;

public class DsaPatternsView extends ViewPart {
    public static final String VIEW_ID = "com.dsatracker.eclipse.views.dsaPatterns";

    private TreeViewer viewer;
    private final List<QuestionV1> questions = new ArrayList<>();
    private DsaBackendClient backendClient;

    @Override
    public void createPartControl(Composite parent) {
        Composite root = new Composite(parent, SWT.NONE);
        root.setLayout(new GridLayout(1, false));

        Composite toolbar = new Composite(root, SWT.NONE);
        toolbar.setLayoutData(new GridData(SWT.FILL, SWT.TOP, true, false));
        toolbar.setLayout(new GridLayout(2, false));

        Text backendUrlInput = new Text(toolbar, SWT.BORDER);
        backendUrlInput.setLayoutData(new GridData(SWT.FILL, SWT.CENTER, true, false));
        backendUrlInput.setText(BackendUrlResolver.resolve());

        Button loadButton = new Button(toolbar, SWT.PUSH);
        loadButton.setText("Load Questions");

        viewer = new TreeViewer(root, SWT.BORDER | SWT.SINGLE | SWT.V_SCROLL | SWT.H_SCROLL);
        viewer.getTree().setLayoutData(new GridData(SWT.FILL, SWT.FILL, true, true));
        viewer.setContentProvider(ArrayContentProvider.getInstance());
        viewer.setLabelProvider(new LabelProvider() {
            @Override
            public String getText(Object element) {
                if (element instanceof QuestionV1 question) {
                    return question.leetcodeId() + ". " + question.title() + " [" + question.difficulty() + "]"
                            + " - " + question.mainPattern() + "/" + question.subPattern();
                }
                return super.getText(element);
            }
        });
        viewer.addDoubleClickListener(new OpenProblemDoubleClickListener());
        loadButton.addListener(SWT.Selection, event -> loadQuestions(backendUrlInput.getText(), loadButton));
        backendUrlInput.addListener(SWT.DefaultSelection, event -> loadQuestions(backendUrlInput.getText(), loadButton));
    }

    @Override
    public void setFocus() {
        if (viewer != null && viewer.getTree() != null) {
            viewer.getTree().setFocus();
        }
    }

    private void loadQuestions(String backendUrl, Button loadButton) {
        String value = backendUrl == null ? "" : backendUrl.trim();
        if (value.isEmpty()) {
            showError("Please provide backend base URL first.");
            return;
        }

        loadButton.setEnabled(false);
        backendClient = new DsaBackendClient(
                new BackendClientConfig(URI.create(value.endsWith("/") ? value : value + "/"), Duration.ofSeconds(20), null),
                new EclipseSecureTokenStore()
        );

        Job loadJob = Job.create("Load questions from backend", monitor -> {
            List<QuestionV1> loaded = backendClient.listQuestionsV1();
            PlatformUI.getWorkbench().getDisplay().asyncExec(() -> {
                if (viewer != null && !viewer.getTree().isDisposed()) {
                    questions.clear();
                    questions.addAll(loaded);
                    viewer.setInput(List.copyOf(questions));
                    loadButton.setEnabled(true);
                }
            });
        }).addJobChangeListener(new JobChangeAdapter() {
            @Override
            public void done(IJobChangeEvent event) {
                if (event.getResult().isOK()) {
                    return;
                }
                PlatformUI.getWorkbench().getDisplay().asyncExec(() -> {
                    loadButton.setEnabled(true);
                    String message = event.getResult().getMessage();
                    if (message == null || message.isBlank()) {
                        message = "Unable to load backend questions from /api/v1/questions.";
                    }
                    showError(message);
                });
            }
        });
        loadJob.schedule();
    }

    private void showError(String message) {
        if (viewer != null && !viewer.getTree().isDisposed()) {
            MessageDialog.openError(viewer.getTree().getShell(), "Backend Load Error", message);
        }
    }

    private final class OpenProblemDoubleClickListener implements IDoubleClickListener {
        @Override
        public void doubleClick(DoubleClickEvent event) {
            ISelection selection = event.getSelection();
            if (!(selection instanceof IStructuredSelection structuredSelection)) {
                return;
            }
            Object selected = structuredSelection.getFirstElement();
            if (!(selected instanceof QuestionV1 question)) {
                return;
            }

            try {
                IFile javaFile = createOrUpdateJavaTemplate(question, new NullProgressMonitor());
                IWorkbenchPage page = PlatformUI.getWorkbench().getActiveWorkbenchWindow().getActivePage();
                IDE.openEditor(page, javaFile);
            } catch (Exception e) {
                showError("Unable to create Java file: " + e.getMessage());
            }
        }

        private IFile createOrUpdateJavaTemplate(QuestionV1 question, IProgressMonitor monitor) throws CoreException {
            IProject project = resolveWritableJavaProject();
            String patternFolder = sanitizePackageSegment(question.mainPattern());
            String subPatternFolder = sanitizePackageSegment(question.subPattern());
            IFolder sourceFolder = project.getFolder("src/main/java/dsa/" + patternFolder + "/" + subPatternFolder);
            createFolders(sourceFolder, monitor);

            String className = "Q" + sanitizeDigits(question.leetcodeId()) + "_" + sanitizeClassSegment(question.title());
            IFile file = sourceFolder.getFile(new Path(className + ".java"));
            String content = starterCode(question, patternFolder, subPatternFolder, className);

            byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
            ByteArrayInputStream input = new ByteArrayInputStream(bytes);
            if (file.exists()) {
                file.setContents(input, true, true, monitor);
            } else {
                file.create(input, true, monitor);
            }
            return file;
        }

        private static IProject resolveWritableJavaProject() {
            IWorkspaceRoot root = ResourcesPlugin.getWorkspace().getRoot();
            for (IProject project : root.getProjects()) {
                try {
                    if (project.isOpen() && project.hasNature("org.eclipse.jdt.core.javanature")) {
                        return project;
                    }
                } catch (CoreException ignored) {
                }
            }
            throw new IllegalStateException("No open Java project found in workspace");
        }

        private static void createFolders(IFolder folder, IProgressMonitor monitor) throws CoreException {
            if (folder.exists()) {
                return;
            }
            if (folder.getParent() instanceof IFolder parent) {
                createFolders(parent, monitor);
            }
            folder.create(true, true, monitor);
        }

        private String sanitizePackageSegment(String value) {
            String cleaned = (value == null ? "general" : value)
                    .toLowerCase()
                    .replaceAll("[^a-z0-9]+", "_")
                    .replaceAll("^_+|_+$", "");
            return cleaned.isBlank() ? "general" : cleaned;
        }

        private String sanitizeDigits(String value) {
            String digits = value == null ? "" : value.replaceAll("[^0-9]", "");
            return digits.isBlank() ? "0000" : digits;
        }

        private String sanitizeClassSegment(String title) {
            String cleaned = (title == null ? "Problem" : title).replaceAll("[^A-Za-z0-9]+", " ").trim();
            if (cleaned.isBlank()) {
                return "Problem";
            }
            StringBuilder builder = new StringBuilder();
            for (String part : cleaned.split("\\s+")) {
                if (part.isBlank()) {
                    continue;
                }
                builder.append(Character.toUpperCase(part.charAt(0)));
                if (part.length() > 1) {
                    builder.append(part.substring(1).toLowerCase());
                }
            }
            if (builder.isEmpty()) {
                return "Problem";
            }
            return builder.toString();
        }

        private String starterCode(QuestionV1 question, String patternFolder, String subPatternFolder, String className) {
            String packageName = "dsa." + patternFolder + "." + subPatternFolder;
            return "package " + packageName + ";\n\n"
                    + "// LeetCode " + question.leetcodeId() + ": " + question.title() + "\n"
                    + "// Difficulty: " + question.difficulty() + "\n"
                    + "// Pattern: " + question.mainPattern() + " / " + question.subPattern() + "\n"
                    + "// URL: " + question.link() + "\n\n"
                    + "public class " + className + " {\n"
                    + "    public void solve() {\n"
                    + "        // TODO: implement solution\n"
                    + "    }\n"
                    + "}\n"
                    + "\n";
        }
    }
}
