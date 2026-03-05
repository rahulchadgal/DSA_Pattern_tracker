package com.dsatracker.eclipse.ui;

import com.dsatracker.idecore.model.PatternNode;
import org.eclipse.jface.viewers.ITreeContentProvider;

import java.util.List;

public class PatternTreeContentProvider implements ITreeContentProvider {
    @Override
    public Object[] getElements(Object inputElement) {
        if (inputElement instanceof List<?> list) {
            return list.toArray();
        }
        return new Object[0];
    }

    @Override
    public Object[] getChildren(Object parentElement) {
        if (parentElement instanceof PatternNode node) {
            return node.getChildren().toArray();
        }
        return new Object[0];
    }

    @Override
    public Object getParent(Object element) {
        return null;
    }

    @Override
    public boolean hasChildren(Object element) {
        return element instanceof PatternNode node && !node.getChildren().isEmpty();
    }
}
