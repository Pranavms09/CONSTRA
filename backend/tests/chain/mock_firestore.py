import copy
import threading
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from google.api_core.exceptions import AlreadyExists


class MockDocSnapshot:
    def __init__(self, doc_id: str, data: Optional[Dict[str, Any]], ref: "MockDocRef"):
        self.id = doc_id
        self._data = copy.deepcopy(data) if data is not None else None
        self.exists = data is not None
        self.reference = ref

    def to_dict(self) -> Optional[Dict[str, Any]]:
        return copy.deepcopy(self._data)


class MockDocRef:
    def __init__(self, doc_id: str, collection: "MockCollection"):
        self.id = doc_id
        self.collection = collection

    def get(self, transaction: Optional["MockTransaction"] = None) -> MockDocSnapshot:
        with self.collection.lock:
            data = self.collection.docs.get(self.id)
            if transaction:
                transaction.record_read(self, data)
            return MockDocSnapshot(self.id, data, self)

    def create(self, data: Dict[str, Any]) -> None:
        with self.collection.lock:
            if self.id in self.collection.docs:
                raise AlreadyExists(f"Document {self.id} already exists")
            payload = copy.deepcopy(data)
            if "created_at" not in payload or payload["created_at"] is None:
                payload["created_at"] = datetime.now(timezone.utc)
            self.collection.docs[self.id] = payload

    def set(self, data: Dict[str, Any], merge: bool = False) -> None:
        with self.collection.lock:
            if merge and self.id in self.collection.docs:
                self.collection.docs[self.id].update(copy.deepcopy(data))
            else:
                self.collection.docs[self.id] = copy.deepcopy(data)

    def update(self, data: Dict[str, Any]) -> None:
        with self.collection.lock:
            if self.id not in self.collection.docs:
                raise KeyError(f"Document {self.id} not found")
            self.collection.docs[self.id].update(copy.deepcopy(data))


class MockCountAggregation:
    def __init__(self, count_val: int):
        self.value = count_val


class MockQuery:
    def __init__(self, collection: "MockCollection", filters=None, orders=None, limit_val=None):
        self.collection = collection
        self.filters = filters or []
        self.orders = orders or []
        self.limit_val = limit_val

    def where(self, field: Optional[str] = None, op: Optional[str] = None, value: Any = None, filter: Any = None) -> "MockQuery":
        if filter is not None:
            field = getattr(filter, "field_path", field)
            op = getattr(filter, "op_string", op)
            value = getattr(filter, "value", value)
        new_filters = list(self.filters)
        new_filters.append((field, op, value))
        return MockQuery(self.collection, new_filters, self.orders, self.limit_val)

    def order_by(self, field: str, direction: str = "ASCENDING") -> "MockQuery":
        new_orders = list(self.orders)
        new_orders.append((field, direction))
        return MockQuery(self.collection, self.filters, new_orders, self.limit_val)

    def limit(self, count: int) -> "MockQuery":
        return MockQuery(self.collection, self.filters, self.orders, count)

    def stream(self) -> List[MockDocSnapshot]:
        with self.collection.lock:
            results = []
            for doc_id, doc_data in self.collection.docs.items():
                match = True
                for field, op, val in self.filters:
                    doc_val = doc_data.get(field)
                    if op == "==":
                        if doc_val != val:
                            match = False
                            break
                    elif op == "<=":
                        if doc_val is None or doc_val > val:
                            match = False
                            break
                    elif op == ">=":
                        if doc_val is None or doc_val < val:
                            match = False
                            break
                if match:
                    results.append(MockDocSnapshot(doc_id, doc_data, MockDocRef(doc_id, self.collection)))

            if self.orders:
                for field, direction in reversed(self.orders):
                    reverse = direction == "DESCENDING"
                    results.sort(key=lambda s: s.to_dict().get(field) or datetime.min.replace(tzinfo=timezone.utc), reverse=reverse)

            if self.limit_val is not None:
                results = results[:self.limit_val]

            return results

    def count(self) -> "MockCountResult":
        class MockCountResult:
            def __init__(self, q: "MockQuery"):
                self.q = q
            def get(self):
                cnt = len(self.q.stream())
                return [[MockCountAggregation(cnt)]]
        return MockCountResult(self)


class MockCollection:
    def __init__(self, name: str):
        self.name = name
        self.docs: Dict[str, Dict[str, Any]] = {}
        self.lock = threading.RLock()

    def document(self, doc_id: Optional[str] = None) -> MockDocRef:
        if not doc_id:
            import uuid
            doc_id = uuid.uuid4().hex
        return MockDocRef(doc_id, self)

    def where(self, field: Optional[str] = None, op: Optional[str] = None, value: Any = None, filter: Any = None) -> MockQuery:
        return MockQuery(self).where(field, op, value, filter=filter)


class MockTransaction:
    _read_only = False
    _id = b"tx1"
    _max_attempts = 5
    in_progress = True

    def __init__(self, client: "MockFirestoreClient"):
        self.client = client
        self.reads: Dict[str, Dict[str, Any]] = {}
        self.updates: List[tuple] = []
        self.sets: List[tuple] = []

    def _begin(self, retry_id=None):
        pass

    def _clean_up(self):
        pass

    def _commit(self):
        return self.commit()

    def _rollback(self):
        pass

    def record_read(self, ref: MockDocRef, data: Optional[Dict[str, Any]]):
        self.reads[f"{ref.collection.name}/{ref.id}"] = copy.deepcopy(data)

    def update(self, ref: MockDocRef, data: Dict[str, Any]):
        self.updates.append((ref, copy.deepcopy(data)))

    def set(self, ref: MockDocRef, data: Dict[str, Any]):
        self.sets.append((ref, copy.deepcopy(data)))

    def commit(self):
        with self.client.global_lock:
            # Check for conflict: has any read document changed?
            for key, initial_data in self.reads.items():
                col_name, doc_id = key.split("/", 1)
                col = self.client.collection(col_name)
                current_data = col.docs.get(doc_id)
                if current_data != initial_data:
                    raise Exception(f"Transaction conflict on {key}")

            # Apply sets and updates atomically
            for ref, data in self.sets:
                ref.collection.docs[ref.id] = data
            for ref, data in self.updates:
                ref.collection.docs[ref.id].update(data)


class MockFirestoreClient:
    def __init__(self):
        self.collections: Dict[str, MockCollection] = {}
        self.global_lock = threading.RLock()

    def collection(self, name: str) -> MockCollection:
        with self.global_lock:
            if name not in self.collections:
                self.collections[name] = MockCollection(name)
            return self.collections[name]

    def transaction(self) -> MockTransaction:
        return MockTransaction(self)
