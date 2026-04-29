
package com.dian.client;

import javax.xml.bind.JAXBElement;
import javax.xml.bind.annotation.XmlAccessType;
import javax.xml.bind.annotation.XmlAccessorType;
import javax.xml.bind.annotation.XmlElementRef;
import javax.xml.bind.annotation.XmlType;


/**
 * <p>Java class for Nota complex type.
 * 
 * <p>The following schema fragment specifies the expected content contained within this class.
 * 
 * <pre>
 * &lt;complexType name="Nota">
 *   &lt;complexContent>
 *     &lt;restriction base="{http://www.w3.org/2001/XMLSchema}anyType">
 *       &lt;sequence>
 *         &lt;element name="ConceptoCorreccion" type="{http://schemas.datacontract.org/2004/07/ConceptoCorreccion}ConceptoCorreccion" minOccurs="0"/>
 *         &lt;element name="Emisor" type="{http://schemas.datacontract.org/2004/07/Entidad}Entidad" minOccurs="0"/>
 *         &lt;element name="LegitimoTenedor" type="{http://schemas.datacontract.org/2004/07/LegitimoTenedor}LegitimoTenedor" minOccurs="0"/>
 *         &lt;element name="NombreTipoDocumento" type="{http://www.w3.org/2001/XMLSchema}string" minOccurs="0"/>
 *         &lt;element name="NumeroDocumento" type="{http://schemas.datacontract.org/2004/07/NumeroDocumento}NumeroDocumento" minOccurs="0"/>
 *         &lt;element name="Receptor" type="{http://schemas.datacontract.org/2004/07/Entidad}Entidad" minOccurs="0"/>
 *         &lt;element name="TotalEImpuestos" type="{http://schemas.datacontract.org/2004/07/TotalEImpuestos}TotalEImpuestos" minOccurs="0"/>
 *         &lt;element name="UUID" type="{http://www.w3.org/2001/XMLSchema}string" minOccurs="0"/>
 *         &lt;element name="ValidacionesDoc" type="{http://schemas.datacontract.org/2004/07/ValidacionDoc}ArrayOfValidacionDoc" minOccurs="0"/>
 *       &lt;/sequence>
 *     &lt;/restriction>
 *   &lt;/complexContent>
 * &lt;/complexType>
 * </pre>
 * 
 * 
 */
@XmlAccessorType(XmlAccessType.FIELD)
@XmlType(name = "Nota", namespace = "http://schemas.datacontract.org/2004/07/Nota", propOrder = {
    "conceptoCorreccion",
    "emisor",
    "legitimoTenedor",
    "nombreTipoDocumento",
    "numeroDocumento",
    "receptor",
    "totalEImpuestos",
    "uuid",
    "validacionesDoc"
})
public class Nota {

    @XmlElementRef(name = "ConceptoCorreccion", namespace = "http://schemas.datacontract.org/2004/07/Nota", type = JAXBElement.class, required = false)
    protected JAXBElement<ConceptoCorreccion> conceptoCorreccion;
    @XmlElementRef(name = "Emisor", namespace = "http://schemas.datacontract.org/2004/07/Nota", type = JAXBElement.class, required = false)
    protected JAXBElement<Entidad> emisor;
    @XmlElementRef(name = "LegitimoTenedor", namespace = "http://schemas.datacontract.org/2004/07/Nota", type = JAXBElement.class, required = false)
    protected JAXBElement<LegitimoTenedor> legitimoTenedor;
    @XmlElementRef(name = "NombreTipoDocumento", namespace = "http://schemas.datacontract.org/2004/07/Nota", type = JAXBElement.class, required = false)
    protected JAXBElement<String> nombreTipoDocumento;
    @XmlElementRef(name = "NumeroDocumento", namespace = "http://schemas.datacontract.org/2004/07/Nota", type = JAXBElement.class, required = false)
    protected JAXBElement<NumeroDocumento> numeroDocumento;
    @XmlElementRef(name = "Receptor", namespace = "http://schemas.datacontract.org/2004/07/Nota", type = JAXBElement.class, required = false)
    protected JAXBElement<Entidad> receptor;
    @XmlElementRef(name = "TotalEImpuestos", namespace = "http://schemas.datacontract.org/2004/07/Nota", type = JAXBElement.class, required = false)
    protected JAXBElement<TotalEImpuestos> totalEImpuestos;
    @XmlElementRef(name = "UUID", namespace = "http://schemas.datacontract.org/2004/07/Nota", type = JAXBElement.class, required = false)
    protected JAXBElement<String> uuid;
    @XmlElementRef(name = "ValidacionesDoc", namespace = "http://schemas.datacontract.org/2004/07/Nota", type = JAXBElement.class, required = false)
    protected JAXBElement<ArrayOfValidacionDoc> validacionesDoc;

    /**
     * Gets the value of the conceptoCorreccion property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link ConceptoCorreccion }{@code >}
     *     
     */
    public JAXBElement<ConceptoCorreccion> getConceptoCorreccion() {
        return conceptoCorreccion;
    }

    /**
     * Sets the value of the conceptoCorreccion property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link ConceptoCorreccion }{@code >}
     *     
     */
    public void setConceptoCorreccion(JAXBElement<ConceptoCorreccion> value) {
        this.conceptoCorreccion = value;
    }

    /**
     * Gets the value of the emisor property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link Entidad }{@code >}
     *     
     */
    public JAXBElement<Entidad> getEmisor() {
        return emisor;
    }

    /**
     * Sets the value of the emisor property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link Entidad }{@code >}
     *     
     */
    public void setEmisor(JAXBElement<Entidad> value) {
        this.emisor = value;
    }

    /**
     * Gets the value of the legitimoTenedor property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link LegitimoTenedor }{@code >}
     *     
     */
    public JAXBElement<LegitimoTenedor> getLegitimoTenedor() {
        return legitimoTenedor;
    }

    /**
     * Sets the value of the legitimoTenedor property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link LegitimoTenedor }{@code >}
     *     
     */
    public void setLegitimoTenedor(JAXBElement<LegitimoTenedor> value) {
        this.legitimoTenedor = value;
    }

    /**
     * Gets the value of the nombreTipoDocumento property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public JAXBElement<String> getNombreTipoDocumento() {
        return nombreTipoDocumento;
    }

    /**
     * Sets the value of the nombreTipoDocumento property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public void setNombreTipoDocumento(JAXBElement<String> value) {
        this.nombreTipoDocumento = value;
    }

    /**
     * Gets the value of the numeroDocumento property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link NumeroDocumento }{@code >}
     *     
     */
    public JAXBElement<NumeroDocumento> getNumeroDocumento() {
        return numeroDocumento;
    }

    /**
     * Sets the value of the numeroDocumento property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link NumeroDocumento }{@code >}
     *     
     */
    public void setNumeroDocumento(JAXBElement<NumeroDocumento> value) {
        this.numeroDocumento = value;
    }

    /**
     * Gets the value of the receptor property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link Entidad }{@code >}
     *     
     */
    public JAXBElement<Entidad> getReceptor() {
        return receptor;
    }

    /**
     * Sets the value of the receptor property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link Entidad }{@code >}
     *     
     */
    public void setReceptor(JAXBElement<Entidad> value) {
        this.receptor = value;
    }

    /**
     * Gets the value of the totalEImpuestos property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link TotalEImpuestos }{@code >}
     *     
     */
    public JAXBElement<TotalEImpuestos> getTotalEImpuestos() {
        return totalEImpuestos;
    }

    /**
     * Sets the value of the totalEImpuestos property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link TotalEImpuestos }{@code >}
     *     
     */
    public void setTotalEImpuestos(JAXBElement<TotalEImpuestos> value) {
        this.totalEImpuestos = value;
    }

    /**
     * Gets the value of the uuid property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public JAXBElement<String> getUUID() {
        return uuid;
    }

    /**
     * Sets the value of the uuid property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public void setUUID(JAXBElement<String> value) {
        this.uuid = value;
    }

    /**
     * Gets the value of the validacionesDoc property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link ArrayOfValidacionDoc }{@code >}
     *     
     */
    public JAXBElement<ArrayOfValidacionDoc> getValidacionesDoc() {
        return validacionesDoc;
    }

    /**
     * Sets the value of the validacionesDoc property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link ArrayOfValidacionDoc }{@code >}
     *     
     */
    public void setValidacionesDoc(JAXBElement<ArrayOfValidacionDoc> value) {
        this.validacionesDoc = value;
    }

}
