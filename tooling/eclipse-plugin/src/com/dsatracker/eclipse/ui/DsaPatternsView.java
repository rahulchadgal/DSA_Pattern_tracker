package com.dsatracker.eclipse.ui;

import com.dsatracker.eclipse.secure.EclipseSecureTokenStore;
import com.dsatracker.idecore.client.BackendClientConfig;
import com.dsatracker.idecore.client.DsaBackendClient;
import com.dsatracker.idecore.model.PatternNode;
import com.dsatracker.idecore.model.QuestionV2;
import com.dsatracker.idecore.tree.PatternTreeBuilder;
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
import org.eclipse.jface.viewers.DoubleClickEvent;
import org.eclipse.jface.viewers.IDoubleClickListener;
import org.eclipse.jface.viewers.ISelection;
import org.eclipse.jface.viewers.IStructuredSelection;
import org.eclipse.jface.viewers.LabelProvider;
import org.eclipse.jface.viewers.TreeViewer;
import org.eclipse.swt.widgets.Composite;
import org.eclipse.ui.IEditorPart;
import org.eclipse.ui.IEditorRegistry;
import org.eclipse.ui.IWorkbenchPage;
import org.eclipse.ui.PartInitException;
import org.eclipse.ui.PlatformUI;
import org.eclipse.ui.ide.IDE;
import org.eclipse.ui.part.ViewPart;

import java.io.ByteArrayInputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;

public class DsaPatternsView extends ViewPart {
    public static final String VIEW_ID = "com.dsatracker.eclipse.views.dsaPatterns";

    private TreeViewer viewer;
    private DsaBackendClient backendClient;

    @Override
    public void createPartControl(Composite parent) {
        viewer = new TreeViewer(parent);
        viewer.setContentProvider(new PatternTreeContentProvider());
        viewer.setLabelProvider(new LabelProvider() {
            @Override
            public String getText(Object element) {
                if (element instanceof PatternNode node) {
                    if (node.getQuestion() != null) {
                        QuestionV2 q = node.getQuestion();
                        return q.title() + " [" + q.difficulty() + "]";
                    }
                    return node.getName();
                }
                return super.getText(element);
            }
        });

        backendClient = new DsaBackendClient(
                new BackendClientConfig(URI.create("http://localhost:8080"), Duration.ofSeconds(15), null),
                new EclipseSecureTokenStore()
        );

        viewer.addDoubleClickListener(new OpenProblemDoubleClickListener());
        fetchPatterns();
    }

    @Override
    public void setFocus() {
        if (viewer != null && viewer.getTree() != null) {
            viewer.getTree().setFocus();
        }
    }

    private void fetchPatterns() {
        Job.create("Load DSA patterns", monitor -> {
            List<QuestionV2> questions = backendClient.listQuestionsV2();
            List<PatternNode> roots = new PatternTreeBuilder().build(questions);
            PlatformUI.getWorkbench().getDisplay().asyncExec(() -> {
                if (viewer != null && !viewer.getTree().isDisposed()) {
                    viewer.setInput(roots);
                    viewer.expandToLevel(2);
                }
            });
        }).schedule();
    }

    private static final class OpenProblemDoubleClickListener implements IDoubleClickListener {
        @Override
        public void doubleClick(DoubleClickEvent event) {
            ISelection selection = event.getSelection();
            if (!(selection instanceof IStructuredSelection structuredSelection)) {
                return;
            }
            Object selected = structuredSelection.getFirstElement();
            if (!(selected instanceof PatternNode node) || node.getQuestion() == null) {
                return;
            }

            try {
                IFile javaFile = createOrUpdateJavaTemplate(node.getQuestion(), new NullProgressMonitor());
                IWorkbenchPage page = PlatformUI.getWorkbench().getActiveWorkbenchWindow().getActivePage();
                IDE.openEditor(page, javaFile);
            } catch (Exception e) {
                throw new RuntimeException("Unable to open Java template", e);
            }
        }

        private static IFile createOrUpdateJavaTemplate(QuestionV2 question, IProgressMonitor monitor) throws CoreException, PartInitException {
            IProject project = resolveWritableJavaProject();
            IFolder sourceFolder = project.getFolder("src/main/java/dsa/generated");
            createFolders(sourceFolder, monitor);

            String className = sanitizeClassName(question.title()) + "Solution";
            IFile file = sourceFolder.getFile(new Path(className + ".java"));
            String content = starterCode(question, className);

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

        private static String sanitizeClassName(String title) {
            String cleaned = title.replaceAll("[^A-Za-z0-9]+", " ").trim();
            StringBuilder sb = new StringBuilder();
            for (String part : cleaned.split("\\s+")) {
                if (part.isEmpty()) {
                    continue;
                }
                sb.append(Character.toUpperCase(part.charAt(0)));
                if (part.length() > 1) {
                    sb.append(part.substring(1).toLowerCase());
                }
            }
            if (sb.isEmpty() || !Character.isJavaIdentifierStart(sb.charAt(0))) {
                sb.insert(0, "Problem");
            }
            return sb.toString();
        }

        private static String starterCode(QuestionV2 question, String className) {
            return "package dsa.generated;\n\n"
                    + "// " + question.title() + " (" + question.leetcodeId() + ")\n"
                    + "// Pattern: " + question.mainPattern() + " / " + question.subPattern() + "\n"
                    + "// Link: " + question.link() + "\n\n"
                    + "public class " + className + " {\n"
                    + "    public void solve() {\n"
                    + "        // TODO: implement\n"
                    + "    }\n"
                    + "}\n";
        }
    }
}
