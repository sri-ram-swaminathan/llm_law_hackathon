"""Seed corpus: which provisions the pack cites and where each comes from (SPEC 6.5)."""

from __future__ import annotations

MIFID = "Directive 2014/65/EU (MiFID II)"
DELREG = "Commission Delegated Regulation (EU) 2017/565"
GDPR = "Regulation (EU) 2016/679 (GDPR)"
AIACT = "Regulation (EU) 2024/1689 (AI Act)"

# id, fetch_celex, celex (as in fixtures), act_title, article, paragraph
CELLAR_SEED: list[dict] = [
    dict(id="mifid2-art4-1-4", fetch="32014L0065", celex="32014L0065", act_title=MIFID, article="4", paragraph="1(4)"),
    dict(id="mifid2-art25-2", fetch="32014L0065", celex="32014L0065", act_title=MIFID, article="25", paragraph="2"),
    dict(id="mifid2-art25-6", fetch="32014L0065", celex="32014L0065", act_title=MIFID, article="25", paragraph="6"),
    dict(id="delreg565-art54-2", fetch="32017R0565", celex="32017R0565", act_title=DELREG, article="54", paragraph="2"),
    dict(id="delreg565-art54-5", fetch="32017R0565", celex="32017R0565", act_title=DELREG, article="54", paragraph="5"),
    dict(id="delreg565-art54-7", fetch="32017R0565", celex="32017R0565", act_title=DELREG, article="54", paragraph="7"),
    # GDPR: base OJ text (the consolidated XHTML lacks per-paragraph structure; Arts 13, 17, 32 unchanged).
    dict(id="gdpr-art13", fetch="32016R0679", celex="32016R0679", act_title=GDPR, article="13", paragraph="1"),
    dict(id="gdpr-art17", fetch="32016R0679", celex="32016R0679", act_title=GDPR, article="17", paragraph="1"),
    dict(id="gdpr-art32", fetch="32016R0679", celex="32016R0679", act_title=GDPR, article="32", paragraph="1"),
    dict(id="aiact-art50", fetch="32024R1689", celex="32024R1689", act_title=AIACT, article="50", paragraph="1"),
]

# Manual French texts: provision id -> data/sources/legifrance/<file>
MANUAL_FR: dict[str, dict] = {
    "cmf-l541-1": dict(file="CMF-L541-1.md", paragraph="I"),
    "cmf-l546-1": dict(file="CMF-L546-1.md", paragraph="I"),
}

ESMA_URL = (
    "https://www.esma.europa.eu/sites/default/files/2023-04/"
    "ESMA35-43-3172_Guidelines_on_certain_aspects_of_the_MiFID_II_suitability_requirements.pdf"
)
ESMA_TITLE = "ESMA Guidelines on certain aspects of the MiFID II suitability requirements (ESMA35-43-3172)"

# Curated guidance excerpts (kind: guidance). ESMA text is verbatim from the PDF;
# AMF and CNIL entries are short English summaries of the cited pages (French originals at source_url).
GUIDANCE: list[dict] = [
    dict(
        id="esma-suitability-2023",
        issuer="ESMA",
        jurisdiction="EU",
        act_title=ESMA_TITLE,
        article="General guideline 2",
        paragraph="19",
        source_url=ESMA_URL,
        text=(
            "Firms must establish, implement and maintain adequate policies and procedures (including "
            "appropriate tools) to enable them to understand the essential facts and characteristics about "
            "their clients. Firms should ensure that the assessment of information collected about their "
            "clients is done in a consistent way irrespective of the means used to collect such information."
        ),
    ),
    dict(
        id="esma-suitability-2023-gg4",
        issuer="ESMA",
        jurisdiction="EU",
        act_title=ESMA_TITLE,
        article="General guideline 4",
        paragraph="44",
        source_url=ESMA_URL,
        text=(
            "Firms should take reasonable steps and have appropriate tools to ensure that the information "
            "collected about their clients is reliable and consistent, without unduly relying on clients' "
            "self-assessment. Clients are expected to provide correct, up-to-date and complete information "
            "necessary for the suitability assessment; firms need to take reasonable steps to check the "
            "reliability, accuracy and consistency of information collected about clients."
        ),
    ),
    dict(
        id="amf-doc-2006-23",
        issuer="AMF",
        jurisdiction="FR",
        act_title="AMF Position-recommandation DOC-2006-23, questions-answers on the regime applicable to financial investment advisers (CIF)",
        article="DOC-2006-23",
        paragraph=None,
        source_url="https://www.amf-france.org/fr/reglementation/doctrine/doc-2006-23",
        text=(
            "The AMF Q&A clarifies which activities fall within or outside the status of conseiller en "
            "investissements financiers (CIF) under articles L. 541-1 to L. 541-9-1 of the Code monétaire et "
            "financier and articles 325-1-A to 325-32 of the AMF General Regulation, and certain CIF "
            "obligations. A person who provides investment advice on a regular basis must hold the CIF status "
            "and be registered with ORIAS (summary of the cited page)."
        ),
    ),
    dict(
        id="amf-doc-2008-23",
        issuer="AMF",
        jurisdiction="FR",
        act_title="AMF Position DOC-2008-23, questions-answers on the notion of the investment service of investment advice",
        article="DOC-2008-23",
        paragraph=None,
        source_url="https://www.amf-france.org/fr/reglementation/doctrine/doc-2008-23",
        text=(
            "The AMF Q&A explains the notion of the investment service of investment advice (MiFID II): "
            "a personal recommendation to a client, on request or at the firm's initiative, concerning "
            "transactions in financial instruments. Whether a service amounts to advice depends on whether "
            "the recommendation is presented as suitable for, or based on the situation of, the client "
            "(summary of the cited page)."
        ),
    ),
    dict(
        id="cnil-information-notice",
        issuer="CNIL",
        jurisdiction="FR",
        act_title="CNIL: Information of individuals and transparency (GDPR Articles 12 to 14)",
        article="Quelles informations dois-je donner ?",
        paragraph=None,
        source_url="https://www.cnil.fr/fr/conformite-rgpd-information-des-personnes-et-transparence",
        text=(
            "The CNIL lists the information to give individuals when collecting their data: identity and "
            "contact details of the controller; purposes; legal basis; whether providing the data is "
            "mandatory or optional and the consequences of not providing it; recipients; retention period "
            "(or criteria); data subject rights (access, rectification, erasure, restriction); DPO or contact "
            "point; the right to lodge a complaint with the CNIL; and, where relevant, transfers outside the EU "
            "(summary of the cited page)."
        ),
    ),
    dict(
        id="cnil-right-to-erasure",
        issuer="CNIL",
        jurisdiction="FR",
        act_title="CNIL: The right to erasure, delete your data online",
        article="A quoi ça sert ?",
        paragraph=None,
        source_url="https://www.cnil.fr/fr/le-droit-leffacement-supprimer-vos-donnees-en-ligne",
        text=(
            "An individual can obtain erasure of their data where at least one situation applies: the data are "
            "used for prospecting; they are no longer necessary for the purposes of collection; consent is "
            "withdrawn; processing is unlawful; the data were collected from a minor for information society "
            "services; erasure is needed to comply with a legal obligation; or the individual objected and the "
            "controller has no overriding legitimate ground (summary of the cited page)."
        ),
    ),
]
