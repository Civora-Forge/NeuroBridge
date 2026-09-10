"""Data export / data deletion — the real, working "see everything about me"
and "delete everything about me" controls (backend/routers/privacy_router.py).

Every assertion here is about the same property the rest of the isolation
suite proves elsewhere: strictly scoped to the caller's own `user.id`, never
touching another user's rows.
"""


def test_export_only_includes_the_caller_s_own_data(login_as, user_a, user_b):
    login_as(user_a).post("/api/ocd/hierarchies/", json={"title": "A's hierarchy", "category": "contamination"})
    login_as(user_b).post("/api/ocd/hierarchies/", json={"title": "B's hierarchy", "category": "symmetry"})

    export_a = login_as(user_a).get("/api/privacy/export")
    assert export_a.status_code == 200
    body = export_a.json()
    assert body["user_id"] == user_a.id
    titles = [h["title"] for h in body["ocd"]["exposure_hierarchies"]]
    assert titles == ["A's hierarchy"]


def test_export_includes_journal_and_agent_data(login_as, user_a):
    client = login_as(user_a)
    client.post(
        "/api/ocd/journal/",
        json={
            "trigger": "doorknob",
            "obsession": "contamination fear",
            "anxiety_level": 60,
        },
    )
    client.post("/api/agent/chat", json={"message": "take me to the ocd tools"})

    export = client.get("/api/privacy/export")
    assert export.status_code == 200
    body = export.json()
    assert len(body["ocd"]["journal_entries"]) == 1
    assert body["ocd"]["journal_entries"][0]["trigger"] == "doorknob"
    assert len(body["agent"]["conversations"]) >= 1


def test_delete_my_data_removes_everything_but_not_other_users(login_as, user_a, user_b):
    client_a = login_as(user_a)
    client_a.post("/api/ocd/hierarchies/", json={"title": "A's hierarchy", "category": "contamination"})
    client_a.post(
        "/api/ocd/journal/",
        json={"trigger": "doorknob", "obsession": "contamination fear", "anxiety_level": 60},
    )
    client_a.post("/api/agent/chat", json={"message": "take me to the ocd tools"})

    client_b = login_as(user_b)
    client_b.post("/api/ocd/hierarchies/", json={"title": "B's hierarchy", "category": "symmetry"})

    delete_response = login_as(user_a).delete("/api/privacy/data")
    assert delete_response.status_code == 200
    assert delete_response.json()["status"] == "deleted"

    export_a = login_as(user_a).get("/api/privacy/export")
    body_a = export_a.json()
    assert body_a["ocd"]["exposure_hierarchies"] == []
    assert body_a["ocd"]["journal_entries"] == []
    assert body_a["agent"]["conversations"] == []

    # User B's data must survive user A's deletion untouched.
    hierarchies_b = login_as(user_b).get("/api/ocd/hierarchies/").json()
    assert [h["title"] for h in hierarchies_b] == ["B's hierarchy"]


def test_delete_my_data_is_idempotent_when_nothing_exists(login_as, user_a):
    response = login_as(user_a).delete("/api/privacy/data")
    assert response.status_code == 200
    assert response.json()["status"] == "deleted"
