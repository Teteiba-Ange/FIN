"""
SoftVotingEnsemble
==================
Top-level class required for pickle serialization compatibility.
Must be importable from any script that loads best_model.pkl.
"""

import numpy as np
from sklearn.base import BaseEstimator, ClassifierMixin, clone


class SoftVotingEnsemble(BaseEstimator, ClassifierMixin):
    """Soft voting ensemble that averages predicted probabilities."""

    def __init__(self, estimators):
        self.estimators = estimators

    def fit(self, X, y):
        self.estimators_ = []
        for name, est in self.estimators:
            cloned = clone(est)
            cloned.fit(X, y)
            self.estimators_.append(cloned)
        self.classes_ = np.unique(y)
        return self

    def predict_proba(self, X):
        probs = np.mean(
            [est.predict_proba(X) for est in self.estimators_], axis=0
        )
        return probs

    def predict(self, X):
        proba = self.predict_proba(X)
        return self.classes_[np.argmax(proba, axis=1)]